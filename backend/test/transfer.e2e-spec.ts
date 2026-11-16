import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authenticatedRequest,
  createTestAccount,
  createTestApp,
  getPrisma,
} from './helpers/e2e-helpers.js';

describe('Transfer E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should transfer money to another wallet', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: sender.walletId },
      data: { balance: 20000 },
    });

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 10000,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      type: 'TRANSFER',
      amount: 10000,
    });

    const senderWallet = await prisma.wallet.findUnique({
      where: { id: sender.walletId },
    });
    const recipientWallet = await prisma.wallet.findUnique({
      where: { id: recipient.walletId },
    });

    expect(senderWallet?.balance).toBe(10000);
    expect(recipientWallet?.balance).toBe(10000);

    const entries = await prisma.walletEntry.findMany({
      where: { transactionId: response.body.id },
    });

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          walletId: sender.walletId,
          amount: -10000,
        }),
        expect.objectContaining({
          walletId: recipient.walletId,
          amount: 10000,
        }),
      ]),
    );
  });

  it('should transfer money using recipient CPF', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: sender.walletId },
      data: { balance: 20000 },
    });

    const formattedCpf = recipient.cpf.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      '$1.$2.$3-$4',
    );

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: formattedCpf,
        amount: 5000,
      });

    expect(response.status).toBe(201);

    const recipientWallet = await prisma.wallet.findUnique({
      where: { id: recipient.walletId },
    });

    expect(recipientWallet?.balance).toBe(5000);
  });

  it('should transfer money using recipient email', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: sender.walletId },
      data: { balance: 20000 },
    });

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.email,
        amount: 5000,
      });

    expect(response.status).toBe(201);

    const recipientWallet = await prisma.wallet.findUnique({
      where: { id: recipient.walletId },
    });

    expect(recipientWallet?.balance).toBe(5000);
  });

  it('should reject transfers to own wallet', async () => {
    const account = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: account.walletId },
      data: { balance: 20000 },
    });

    const response = await authenticatedRequest(app, account.token)
      .post('/wallets/transfer', {
        recipient: account.walletId,
        amount: 5000,
      });

    expect(response.status).toBe(400);

    const wallet = await prisma.wallet.findUnique({
      where: { id: account.walletId },
    });

    expect(wallet?.balance).toBe(20000);
    expect(
      await prisma.walletEntry.count({
        where: { walletId: account.walletId },
      }),
    ).toBe(0);
  });

  it('should reject transfers to nonexistent recipients', async () => {
    const sender = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: sender.walletId },
      data: { balance: 20000 },
    });

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: 'inexistente@email.com',
        amount: 5000,
      });

    expect(response.status).toBe(404);

    expect(
      await prisma.walletEntry.count({
        where: { walletId: sender.walletId },
      }),
    ).toBe(0);
  });

  it('should reject transfers with insufficient balance', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: sender.walletId },
      data: { balance: 5000 },
    });

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 10000,
      });

    expect(response.status).toBe(400);

    const senderWallet = await prisma.wallet.findUnique({
      where: { id: sender.walletId },
    });

    const recipientWallet = await prisma.wallet.findUnique({
      where: { id: recipient.walletId },
    });

    expect(senderWallet?.balance).toBe(5000);
    expect(recipientWallet?.balance).toBe(0);
    expect(
      await prisma.walletEntry.count({
        where: {
          walletId: {
            in: [sender.walletId, recipient.walletId],
          },
        },
      }),
    ).toBe(0);
  });

  it('should reject amounts above the maximum limit', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 2000001,
      });

    expect(response.status).toBe(400);
  });

  it('should reject zero amounts', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 0,
      });

    expect(response.status).toBe(400);
  });

  it('should reject negative amounts', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: -10000,
      });

    expect(response.status).toBe(400);
  });

  it('should reject non-integer amounts', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: '100.50',
      });

    expect(response.status).toBe(400);
  });

  it('should accept the maximum transfer amount', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: sender.walletId },
      data: { balance: 2000000 },
    });

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 2000000,
      });

    expect(response.status).toBe(201);

    const senderWallet = await prisma.wallet.findUnique({
      where: { id: sender.walletId },
    });

    const recipientWallet = await prisma.wallet.findUnique({
      where: { id: recipient.walletId },
    });

    expect(senderWallet?.balance).toBe(0);
    expect(recipientWallet?.balance).toBe(2000000);
  });

  it('should require an amount', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
      });

    expect(response.status).toBe(400);
  });

  it('should require a recipient', async () => {
    const sender = await createTestAccount(app);

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        amount: 1000,
      });

    expect(response.status).toBe(400);
  });

  it('should prevent guests from making transfers', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    const response = await authenticatedRequest(app, 'invalid-token')
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 1000,
      });

    expect(response.status).toBe(401);

    expect(
      await prisma.walletEntry.count({
        where: {
          walletId: {
            in: [sender.walletId, recipient.walletId],
          },
        },
      }),
    ).toBe(0);
  });

  it('should reject transfers when sender has no wallet', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.delete({
      where: { id: sender.walletId },
    });

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 1000,
      });

    expect(response.status).toBe(404);
  });

  it('should reject transfers when recipient has no wallet', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: sender.walletId },
      data: { balance: 5000 },
    });

    await prisma.wallet.delete({
      where: { id: recipient.walletId },
    });

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.email,
        amount: 1000,
      });

    expect(response.status).toBe(404);

    const senderWallet = await prisma.wallet.findUnique({
      where: { id: sender.walletId },
    });

    expect(senderWallet?.balance).toBe(5000);
  });

  it('should reject non-string recipients', async () => {
    const sender = await createTestAccount(app);

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: 12345,
        amount: 1000,
      });

    expect(response.status).toBe(400);
  });

  it('should reject recipients above maximum length', async () => {
    const sender = await createTestAccount(app);

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: 'a'.repeat(256),
        amount: 1000,
      });

    expect(response.status).toBe(400);
  });

  it('should reject non-numeric amounts', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);

    const response = await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 'abc',
      });

    expect(response.status).toBe(400);
  });
});
