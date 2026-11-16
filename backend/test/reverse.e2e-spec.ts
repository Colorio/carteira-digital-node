import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authenticatedRequest,
  createTestAccount,
  createTestApp,
  getPrisma,
} from './helpers/e2e-helpers.js';

describe('Reversal E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reverse a deposit', async () => {
    const account = await createTestAccount(app);
    const prisma = getPrisma(app);

    await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: 10000 })
      .expect(201);

    const original = await prisma.transaction.findFirst({
      where: {
        entries: {
          some: { walletId: account.walletId },
        },
      },
    });

    const response = await authenticatedRequest(app, account.token)
      .post(`/transactions/${original!.id}/reversal`);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      type: 'REVERSAL',
      amount: 10000,
      reversesTransactionId: original!.id,
    });

    const wallet = await prisma.wallet.findUnique({
      where: { id: account.walletId },
    });

    const updatedOriginal = await prisma.transaction.findUnique({
      where: { id: original!.id },
    });

    expect(wallet?.balance).toBe(0);
    expect(updatedOriginal?.status).toBe('REVERSED');
    expect(
      await prisma.transaction.count({
        where: {
          entries: {
            some: { walletId: account.walletId },
          },
        },
      }),
    ).toBe(2);
    expect(
      await prisma.walletEntry.count({
        where: { walletId: account.walletId },
      }),
    ).toBe(2);
  });

  it('should reject reversing a deposit with insufficient balance', async () => {
    const account = await createTestAccount(app);
    const prisma = getPrisma(app);

    await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: 10000 })
      .expect(201);

    const original = await prisma.transaction.findFirst({
      where: {
        entries: {
          some: { walletId: account.walletId },
        },
      },
    });

    await prisma.wallet.update({
      where: { id: account.walletId },
      data: { balance: 5000 },
    });

    const response = await authenticatedRequest(app, account.token)
      .post(`/transactions/${original!.id}/reversal`);

    expect(response.status).toBe(400);

    const wallet = await prisma.wallet.findUnique({
      where: { id: account.walletId },
    });

    const updatedOriginal = await prisma.transaction.findUnique({
      where: { id: original!.id },
    });

    expect(wallet?.balance).toBe(5000);
    expect(updatedOriginal?.status).toBe('COMPLETED');
    expect(
      await prisma.walletEntry.count({
        where: { walletId: account.walletId },
      }),
    ).toBe(1);
  });

  it('should reverse a transfer within five minutes', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: sender.walletId },
      data: { balance: 10000 },
    });

    const transfer = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 10000,
      })
      .expect(201);

    const response = await authenticatedRequest(app, sender.token)
      .post(`/transactions/${transfer.body.id}/reversal`);

    expect(response.status).toBe(201);

    const senderWallet = await prisma.wallet.findUnique({
      where: { id: sender.walletId },
    });

    const recipientWallet = await prisma.wallet.findUnique({
      where: { id: recipient.walletId },
    });

    const original = await prisma.transaction.findUnique({
      where: { id: transfer.body.id },
    });

    expect(senderWallet?.balance).toBe(10000);
    expect(recipientWallet?.balance).toBe(0);
    expect(original?.status).toBe('REVERSED');
  });

  it('should reject reversing a transfer after five minutes', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: sender.walletId },
      data: { balance: 10000 },
    });

    const transfer = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 10000,
      })
      .expect(201);

    await prisma.transaction.update({
      where: { id: transfer.body.id },
      data: {
        createdAt: new Date(Date.now() - 6 * 60 * 1000),
      },
    });

    const response = await authenticatedRequest(app, sender.token)
      .post(`/transactions/${transfer.body.id}/reversal`);

    expect(response.status).toBe(400);

    const senderWallet = await prisma.wallet.findUnique({
      where: { id: sender.walletId },
    });

    const recipientWallet = await prisma.wallet.findUnique({
      where: { id: recipient.walletId },
    });

    const original = await prisma.transaction.findUnique({
      where: { id: transfer.body.id },
    });

    expect(senderWallet?.balance).toBe(0);
    expect(recipientWallet?.balance).toBe(10000);
    expect(original?.status).toBe('COMPLETED');
  });

  it('should prevent guests from reversing transactions', async () => {
    const account = await createTestAccount(app);
    const prisma = getPrisma(app);

    await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: 10000 })
      .expect(201);

    const transaction = await prisma.transaction.findFirst({
      where: {
        entries: {
          some: { walletId: account.walletId },
        },
      },
    });

    const response = await authenticatedRequest(app, 'invalid-token')
      .post(`/transactions/${transaction!.id}/reversal`);

    expect(response.status).toBe(401);

    const wallet = await prisma.wallet.findUnique({
      where: { id: account.walletId },
    });

    expect(wallet?.balance).toBe(10000);
    expect(
      await prisma.transaction.count({
        where: {
          entries: {
            some: { walletId: account.walletId },
          },
        },
      }),
    ).toBe(1);
  });

  it('should prevent users from reversing another user transaction', async () => {
    const owner = await createTestAccount(app);
    const other = await createTestAccount(app);
    const prisma = getPrisma(app);

    await authenticatedRequest(app, owner.token)
      .post('/wallets/deposit', { amount: 10000 })
      .expect(201);

    const transaction = await prisma.transaction.findFirst({
      where: {
        entries: {
          some: { walletId: owner.walletId },
        },
      },
    });

    const response = await authenticatedRequest(app, other.token)
      .post(`/transactions/${transaction!.id}/reversal`);

    expect(response.status).toBe(404);

    const wallet = await prisma.wallet.findUnique({
      where: { id: owner.walletId },
    });

    expect(wallet?.balance).toBe(10000);
    expect(
      await prisma.walletEntry.count({
        where: { walletId: owner.walletId },
      }),
    ).toBe(1);
  });

  it('should prevent reversing a transaction twice', async () => {
    const account = await createTestAccount(app);
    const prisma = getPrisma(app);

    await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: 10000 })
      .expect(201);

    const transaction = await prisma.transaction.findFirst({
      where: {
        entries: {
          some: { walletId: account.walletId },
        },
      },
    });

    await authenticatedRequest(app, account.token)
      .post(`/transactions/${transaction!.id}/reversal`)
      .expect(201);

    const response = await authenticatedRequest(app, account.token)
      .post(`/transactions/${transaction!.id}/reversal`);

    expect(response.status).toBe(400);

    const wallet = await prisma.wallet.findUnique({
      where: { id: account.walletId },
    });

    expect(wallet?.balance).toBe(0);
    expect(
      await prisma.walletEntry.count({
        where: { walletId: account.walletId },
      }),
    ).toBe(2);
  });

  it('should reject reversing an unsupported transaction type', async () => {
    const account = await createTestAccount(app);
    const prisma = getPrisma(app);

    const transaction = await prisma.transaction.create({
      data: {
        type: 'REVERSAL',
        amount: 1000,
        entries: {
          create: {
            walletId: account.walletId,
            amount: 1000,
          },
        },
      },
    });

    const response = await authenticatedRequest(app, account.token)
      .post(`/transactions/${transaction.id}/reversal`);

    expect(response.status).toBe(400);

    const wallet = await prisma.wallet.findUnique({
      where: { id: account.walletId },
    });

    expect(wallet?.balance).toBe(0);
    expect(
      await prisma.walletEntry.count({
        where: { walletId: account.walletId },
      }),
    ).toBe(1);
  });

  it('should reject reversing transactions with inconsistent entries', async () => {
    const account = await createTestAccount(app);
    const prisma = getPrisma(app);

    const transaction = await prisma.transaction.create({
      data: {
        type: 'DEPOSIT',
        amount: 10000,
      },
    });

    const response = await authenticatedRequest(app, account.token)
      .post(`/transactions/${transaction.id}/reversal`);

    expect(response.status).toBe(404);

    const wallet = await prisma.wallet.findUnique({
      where: { id: account.walletId },
    });

    expect(wallet?.balance).toBe(0);
    expect(
      await prisma.walletEntry.count({
        where: { transactionId: transaction.id },
      }),
    ).toBe(0);
  });

  it('should reject reversing transactions without participating wallets', async () => {
    const owner = await createTestAccount(app);
    const other = await createTestAccount(app);
    const prisma = getPrisma(app);

    const transaction = await prisma.transaction.create({
      data: {
        type: 'DEPOSIT',
        amount: 10000,
        entries: {
          create: {
            walletId: owner.walletId,
            amount: 10000,
          },
        },
      },
    });

    const response = await authenticatedRequest(app, other.token)
      .post(`/transactions/${transaction.id}/reversal`);

    expect(response.status).toBe(404);

    const ownerWallet = await prisma.wallet.findUnique({
      where: { id: owner.walletId },
    });

    const otherWallet = await prisma.wallet.findUnique({
      where: { id: other.walletId },
    });

    expect(ownerWallet?.balance).toBe(0);
    expect(otherWallet?.balance).toBe(0);
    expect(
      await prisma.walletEntry.count({
        where: { transactionId: transaction.id },
      }),
    ).toBe(1);
  });
});
