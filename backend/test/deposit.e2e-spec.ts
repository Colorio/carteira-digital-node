import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestAccount,
  createTestApp,
  getPrisma,
  authenticatedRequest,
} from './helpers/e2e-helpers.js';

describe('Deposit E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should prevent guests from making deposits', async () => {
    const account = await createTestAccount(app);
    const prisma = getPrisma(app);

    const response = await authenticatedRequest(app, 'invalid-token')
      .post('/wallets/deposit', { amount: 10000 });

    expect(response.status).toBe(401);

    expect(
      await prisma.walletEntry.count({
        where: { walletId: account.walletId },
      }),
    ).toBe(0);
  });

  it('should allow a user to make a deposit and create an audit log', async () => {
    const account = await createTestAccount(app);
    const prisma = getPrisma(app);

    const response = await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: 10000 });

    expect(response.status).toBe(201);
    expect(response.body.balance).toBe(10000);

    const transaction = await prisma.transaction.findFirst({
      where: {
        entries: {
          some: { walletId: account.walletId },
        },
      },
    });

    expect(transaction).toMatchObject({
      type: 'DEPOSIT',
      status: 'COMPLETED',
      amount: 10000,
    });

    expect(
      await prisma.walletEntry.count({
        where: {
          walletId: account.walletId,
          transactionId: transaction!.id,
          amount: 10000,
        },
      }),
    ).toBe(1);

    const auditLog = await prisma.auditLog.findUnique({
      where: {
        transactionId: transaction!.id,
      },
    });

    expect(auditLog).toMatchObject({
      actorUserId: account.id,
      transactionId: transaction!.id,
      action: 'DEPOSIT',
      metadata: {
        walletId: account.walletId,
        amount: 10000,
      },
    });
  });

  it('should require an amount', async () => {
    const account = await createTestAccount(app);

    const response = await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', {});

    expect(response.status).toBe(400);
  });

  it('should reject zero amounts', async () => {
    const account = await createTestAccount(app);

    const response = await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: 0 });

    expect(response.status).toBe(400);
  });

  it('should reject negative amounts', async () => {
    const account = await createTestAccount(app);

    const response = await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: -10000 });

    expect(response.status).toBe(400);
  });

  it('should reject non-integer amounts', async () => {
    const account = await createTestAccount(app);

    const response = await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: '100.50' });

    expect(response.status).toBe(400);
  });

  it('should reject amounts above the maximum limit', async () => {
    const account = await createTestAccount(app);

    const response = await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: 10000000 });

    expect(response.status).toBe(400);
  });

  it('should accept the maximum deposit amount', async () => {
    const account = await createTestAccount(app);

    const response = await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: 9999999 });

    expect(response.status).toBe(201);
    expect(response.body.balance).toBe(9999999);
  });

  it('should add deposits to a negative balance', async () => {
    const account = await createTestAccount(app);
    const prisma = getPrisma(app);

    await prisma.wallet.update({
      where: { id: account.walletId },
      data: { balance: -5000 },
    });

    const response = await authenticatedRequest(app, account.token)
      .post('/wallets/deposit', { amount: 8000 });

    expect(response.status).toBe(201);
    expect(response.body.balance).toBe(3000);
  });
});
