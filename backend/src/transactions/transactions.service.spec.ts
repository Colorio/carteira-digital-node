import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('TransactionsService', () => {
  let service: TransactionsService;

  let prisma: {
    walletEntry: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    transaction: {
      findUnique: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    wallet: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    auditLog: {
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      walletEntry: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      transaction: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
      wallet: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return the user transaction history', async () => {
    const entries = [
      {
        id: 'entry-id',
        amount: -3000,
        createdAt: new Date(),
        transaction: {
          id: 'transaction-id',
          type: 'TRANSFER',
          status: 'COMPLETED',
          amount: 3000,
          createdAt: new Date(),
          entries: [
            {
              walletId: 'wallet-id',
              wallet: {
                user: {
                  id: 'user-id',
                  name: 'Usuário',
                },
              },
            },
            {
              walletId: 'recipient-wallet-id',
              wallet: {
                user: {
                  id: 'recipient-id',
                  name: 'Destinatário',
                },
              },
            },
          ],
        },
      },
    ];

    prisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet-id',
    });
    prisma.walletEntry.findMany.mockResolvedValue(entries);
    prisma.walletEntry.count.mockResolvedValue(1);

    const result = await service.findAllByUserId('user-id');

    expect(result).toEqual({
      data: [
        {
          id: 'entry-id',
          transaction_id: 'transaction-id',
          type: 'TRANSFER',
          status: 'COMPLETED',
          direction: 'debit',
          amount: '3000',
          created_at: entries[0].createdAt,
          counterparty: {
            id: 'recipient-id',
            name: 'Destinatário',
          },
        },
      ],
      pagination: {
        total: 1,
        per_page: 10,
        current_page: 1,
        last_page: 1,
      },
    });

    expect(prisma.walletEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          walletId: 'wallet-id',
        },
        skip: 0,
        take: 10,
      }),
    );
  });

  it('should throw NotFoundException when transaction does not exist', async () => {
    prisma.$transaction.mockImplementation(async (callback) => {
      return callback(prisma);
    });

    prisma.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.reverse('user-id', 'transaction-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when transaction was already reversed', async () => {
    prisma.$transaction.mockImplementation(async (callback) => {
      return callback(prisma);
    });

    prisma.transaction.findUnique.mockResolvedValue({
      id: 'transaction-id',
      type: 'DEPOSIT',
      status: 'REVERSED',
      amount: 5000,
      reversesTransactionId: null,
      entries: [],
    });

    await expect(
      service.reverse('user-id', 'transaction-id'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when user does not own the transaction', async () => {
    prisma.$transaction.mockImplementation(async (callback) => {
      return callback(prisma);
    });

    prisma.transaction.findUnique.mockResolvedValue({
      id: 'transaction-id',
      type: 'TRANSFER',
      status: 'COMPLETED',
      amount: 3000,
      reversesTransactionId: null,
      createdAt: new Date(),
      entries: [
        {
          walletId: 'wallet-id',
          amount: 3000,
          wallet: {
            userId: 'another-user-id',
          },
        },
      ],
    });

    await expect(
      service.reverse('user-id', 'transaction-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException when transaction is reversed concurrently', async () => {
    prisma.$transaction.mockImplementation(async (callback) => {
      return callback(prisma);
    });

    prisma.transaction.findUnique.mockResolvedValue({
      id: 'transaction-id',
      type: 'DEPOSIT',
      status: 'COMPLETED',
      amount: 5000,
      reversesTransactionId: null,
      entries: [
        {
          walletId: 'wallet-id',
          amount: 5000,
          wallet: {
            userId: 'user-id',
          },
        },
      ],
    });

    prisma.transaction.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.reverse('user-id', 'transaction-id'),
    ).rejects.toThrow(ConflictException);
  });

  it('should reverse transaction and create audit log', async () => {
    prisma.$transaction.mockImplementation(async (callback) => {
      return callback(prisma);
    });

    prisma.transaction.findUnique.mockResolvedValue({
      id: 'transaction-id',
      type: 'DEPOSIT',
      status: 'COMPLETED',
      amount: 5000,
      reversesTransactionId: null,
      entries: [
        {
          walletId: 'wallet-id',
          amount: 5000,
          wallet: {
            userId: 'user-id',
          },
        },
      ],
    });

    prisma.transaction.updateMany.mockResolvedValue({
      count: 1,
    });

    prisma.wallet.updateMany.mockResolvedValue({
      count: 1,
    });

    prisma.transaction.create.mockResolvedValue({
      id: 'reversal-id',
      type: 'REVERSAL',
      amount: 5000,
      createdAt: new Date(),
      reversesTransactionId: 'transaction-id',
    });

    prisma.auditLog.create.mockResolvedValue({
      id: 'audit-id',
    });

    const result = await service.reverse('user-id', 'transaction-id');

    expect(result.id).toBe('reversal-id');

    expect(prisma.wallet.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'wallet-id',
        balance: {
          gte: 5000,
        },
      },
      data: {
        balance: {
          decrement: 5000,
        },
      },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'user-id',
        transactionId: 'reversal-id',
        action: 'REVERSAL',
        metadata: {
          originalTransactionId: 'transaction-id',
          amount: 5000,
          walletIds: ['wallet-id'],
        },
      },
    });
  });

  it('should reject deposit reversal when balance is insufficient', async () => {
    prisma.$transaction.mockImplementation(async (callback) => {
      return callback(prisma);
    });

    prisma.transaction.findUnique.mockResolvedValue({
      id: 'transaction-id',
      type: 'DEPOSIT',
      status: 'COMPLETED',
      amount: 5000,
      reversesTransactionId: null,
      entries: [
        {
          walletId: 'wallet-id',
          amount: 5000,
          wallet: {
            userId: 'user-id',
          },
        },
      ],
    });

    prisma.transaction.updateMany.mockResolvedValue({
      count: 1,
    });

    prisma.wallet.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.reverse('user-id', 'transaction-id'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
