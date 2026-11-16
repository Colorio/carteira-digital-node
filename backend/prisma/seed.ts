import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker/locale/pt_BR';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const USERS_COUNT = 20;
const TRANSFERS_COUNT = 40;
const DEFAULT_PASSWORD = '12345678';

function calculateCpfDigit(digits: number[], weight: number): number {
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (weight - index),
    0,
  );

  const remainder = (sum * 10) % 11;

  return remainder === 10 ? 0 : remainder;
}

function generateCpf(): string {
  const digits = Array.from({ length: 9 }, () =>
    faker.number.int({ min: 0, max: 9 }),
  );

  digits.push(calculateCpfDigit(digits, 10));
  digits.push(calculateCpfDigit(digits, 11));

  return digits.join('');
}

async function createDeposit(walletId: string, amount: number) {
  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: 'DEPOSIT',
        amount,
      },
    });

    await tx.walletEntry.create({
      data: {
        walletId,
        transactionId: transaction.id,
        amount,
      },
    });

    await tx.wallet.update({
      where: { id: walletId },
      data: {
        balance: { increment: amount },
      },
    });
  });
}

async function createTransfer(
  senderWalletId: string,
  recipientWalletId: string,
  amount: number,
) {
  await prisma.$transaction(async (tx) => {
    const debit = await tx.wallet.updateMany({
      where: {
        id: senderWalletId,
        balance: { gte: amount },
      },
      data: {
        balance: { decrement: amount },
      },
    });

    if (debit.count === 0) {
      return;
    }

    await tx.wallet.update({
      where: { id: recipientWalletId },
      data: {
        balance: { increment: amount },
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        type: 'TRANSFER',
        amount,
      },
    });

    await tx.walletEntry.createMany({
      data: [
        {
          walletId: senderWalletId,
          transactionId: transaction.id,
          amount: -amount,
        },
        {
          walletId: recipientWalletId,
          transactionId: transaction.id,
          amount,
        },
      ],
    });
  });
}

async function main() {
  const password = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const users = [];

  for (let index = 0; index < USERS_COUNT; index++) {
    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        cpf: generateCpf(),
        password,
        wallet: {
          create: {},
        },
      },
      include: {
        wallet: true,
      },
    });

    if (!user.wallet) {
      throw new Error(`Carteira não encontrada para ${user.email}`);
    }

    users.push({
      ...user,
      wallet: user.wallet,
    });
  }

  for (const user of users) {
    const depositsCount = faker.number.int({ min: 1, max: 4 });

    for (let index = 0; index < depositsCount; index++) {
      await createDeposit(
        user.wallet.id,
        faker.number.int({ min: 10000, max: 500000 }),
      );
    }
  }

  for (let index = 0; index < TRANSFERS_COUNT; index++) {
    const senderIndex = faker.number.int({
      min: 0,
      max: users.length - 1,
    });

    let recipientIndex = senderIndex;

    while (recipientIndex === senderIndex) {
      recipientIndex = faker.number.int({
        min: 0,
        max: users.length - 1,
      });
    }

    await createTransfer(
      users[senderIndex].wallet.id,
      users[recipientIndex].wallet.id,
      faker.number.int({ min: 1000, max: 100000 }),
    );
  }

  console.log(`${users.length} usuários criados.`);
  console.log(`${TRANSFERS_COUNT} transferências processadas.`);
  console.log(`Senha padrão: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
