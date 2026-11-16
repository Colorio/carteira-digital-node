import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authenticatedRequest,
  createTestAccount,
  createTestApp,
  getPrisma,
} from './helpers/e2e-helpers.js';

describe('Wallet Balance Consistency E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should keep wallet balances consistent with ledger entries', async () => {
    const sender = await createTestAccount(app);
    const recipient = await createTestAccount(app);
    const prisma = getPrisma(app);

    await authenticatedRequest(app, sender.token)
      .post('/wallets/deposit', { amount: 20000 })
      .expect(201);

    await authenticatedRequest(app, sender.token)
      .post('/wallets/transfer', {
        recipient: recipient.walletId,
        amount: 7000,
      })
      .expect(201);

    const wallets = await prisma.wallet.findMany({
      where: {
        id: {
          in: [sender.walletId, recipient.walletId],
        },
      },
      select: {
        id: true,
        balance: true,
        entries: {
          select: {
            amount: true,
          },
        },
      },
    });

    for (const wallet of wallets) {
      const ledgerBalance = wallet.entries.reduce(
        (total, entry) => total + entry.amount,
        0,
      );

      expect(wallet.balance).toBe(ledgerBalance);
    }
  });
});
