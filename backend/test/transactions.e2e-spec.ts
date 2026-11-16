import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authenticatedRequest,
  createTestAccount,
  createTestApp,
  getPrisma,
} from './helpers/e2e-helpers.js';

describe('Transaction E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should show only the authenticated user transaction history', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const other = await createTestAccount(app);
    const prisma = getPrisma(app);

    await authenticatedRequest(app, sender.token)
      .post('/wallets/deposit', { amount: 5000 })
      .expect(201);

    await prisma.wallet.update({
      where: { id: sender.walletId },
      data: { balance: 5000 },
    });

    await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 2000,
      })
      .expect(201);

    await authenticatedRequest(app, other.token)
      .post('/wallets/deposit', { amount: 9000 })
      .expect(201);

    const response = await authenticatedRequest(app, sender.token)
      .get('/transactions');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);

    expect(response.body.data[0]).toMatchObject({
      transaction_id: expect.any(String),
      type: 'TRANSFER',
      status: 'COMPLETED',
      direction: 'debit',
      amount: '2000',
      counterparty: {
        id: recipient.id,
        name: 'Usuário de teste',
      },
    });

    expect(response.body.data[1]).toMatchObject({
      transaction_id: expect.any(String),
      type: 'DEPOSIT',
      status: 'COMPLETED',
      direction: 'credit',
      amount: '5000',
      counterparty: null,
    });

    expect(response.body.data.some(
      (entry: { amount: string }) => entry.amount === '9000',
    )).toBe(false);

    expect(response.body.pagination).toMatchObject({
      total: 2,
      per_page: 10,
      current_page: 1,
      last_page: 1,
    });
  });

  it('should prevent guests from viewing transaction history', async () => {
    const response = await authenticatedRequest(app, 'invalid-token')
      .get('/transactions');

    expect(response.status).toBe(401);
  });

  it('should paginate transaction history', async () => {
    const account = await createTestAccount(app);

    for (let index = 0; index < 11; index++) {
      await authenticatedRequest(app, account.token)
        .post('/wallets/deposit', { amount: 1000 })
        .expect(201);
    }

    const response = await authenticatedRequest(app, account.token)
      .get('/transactions?page=1&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(10);
    expect(response.body.pagination).toMatchObject({
      total: 11,
      per_page: 10,
      current_page: 1,
      last_page: 2,
    });
  });
});
