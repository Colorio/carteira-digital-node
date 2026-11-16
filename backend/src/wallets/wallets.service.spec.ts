import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { WalletsService } from './wallets.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('WalletsService', () => {
  let service: WalletsService;
  let prisma: {
    wallet: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let tx: {
    wallet: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    user: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    transaction: {
      create: ReturnType<typeof vi.fn>;
    };
    auditLog: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    tx = {
      wallet: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
      transaction: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    prisma = {
      wallet: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByUserId', () => {
    it('should return the user wallet', async () => {
      const wallet = {
        id: 'wallet-id',
        balance: 10000,
        createdAt: new Date(),
      };

      prisma.wallet.findUnique.mockResolvedValue(wallet);

      const result = await service.findByUserId('user-id');

      expect(result).toEqual(wallet);
      expect(prisma.wallet.findUnique).toHaveBeenCalledWith({
        select: {
          id: true,
          balance: true,
          createdAt: true,
        },
        where: {
          userId: 'user-id',
        },
      });
    });

    it('should throw NotFoundException when wallet does not exist', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null);

      await expect(
        service.findByUserId('user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deposit', () => {
    it('should deposit money into the wallet', async () => {
      const wallet = { id: 'wallet-id' };
      const updatedWallet = {
        id: 'wallet-id',
        balance: 15000,
        updatedAt: new Date(),
      };

      tx.wallet.findUnique.mockResolvedValue(wallet);
      tx.transaction.create.mockResolvedValue({
        id: 'transaction-id',
      });
      tx.wallet.update.mockResolvedValue(updatedWallet);

      const result = await service.deposit('user-id', 5000);

      expect(result).toEqual(updatedWallet);
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: {
          type: 'DEPOSIT',
          amount: 5000,
          entries: {
            create: {
              walletId: 'wallet-id',
              amount: 5000,
            },
          },
        },
        select: {
          id: true,
        },
      });
      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorUserId: 'user-id',
          transactionId: 'transaction-id',
          action: 'DEPOSIT',
          metadata: {
            walletId: 'wallet-id',
            amount: 5000,
          },
        },
      });
      expect(tx.wallet.update).toHaveBeenCalledWith({
        select: {
          id: true,
          balance: true,
          updatedAt: true,
        },
        where: {
          id: 'wallet-id',
        },
        data: {
          balance: {
            increment: 5000,
          },
        },
      });
    });

    it('should throw NotFoundException when wallet does not exist', async () => {
      tx.wallet.findUnique.mockResolvedValue(null);

      await expect(
        service.deposit('user-id', 5000),
      ).rejects.toThrow(NotFoundException);

      expect(tx.transaction.create).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
      expect(tx.wallet.update).not.toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    it('should transfer money using recipient email', async () => {
      const transaction = {
        id: 'transaction-id',
        type: 'TRANSFER',
        amount: 5000,
        createdAt: new Date(),
        entries: [
          { walletId: 'sender-wallet', amount: -5000 },
          { walletId: 'recipient-wallet', amount: 5000 },
        ],
      };

      tx.wallet.findUnique
        .mockResolvedValueOnce({ id: 'sender-wallet' })
        .mockResolvedValueOnce({ id: 'recipient-wallet' });

      tx.user.findFirst.mockResolvedValue({ id: 'recipient-id' });
      tx.wallet.updateMany.mockResolvedValue({ count: 1 });
      tx.wallet.update.mockResolvedValue({});
      tx.transaction.create.mockResolvedValue(transaction);

      const result = await service.transfer(
        'sender-id',
        'destinatario@email.com',
        5000,
      );

      expect(result).toEqual(transaction);
      expect(tx.user.findFirst).toHaveBeenCalledWith({
        select: {
          id: true,
        },
        where: {
          OR: [
            { email: 'destinatario@email.com' },
          ],
        },
      });
      expect(tx.wallet.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'sender-wallet',
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
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: {
          id: 'recipient-wallet',
        },
        data: {
          balance: {
            increment: 5000,
          },
        },
      });
      expect(tx.transaction.create).toHaveBeenCalled();
      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorUserId: 'sender-id',
          transactionId: 'transaction-id',
          action: 'TRANSFER',
          metadata: {
            senderWalletId: 'sender-wallet',
            recipientWalletId: 'recipient-wallet',
            amount: 5000,
          },
        },
      });
    });

    it('should throw NotFoundException when sender wallet does not exist', async () => {
      tx.wallet.findUnique.mockResolvedValue(null);

      await expect(
        service.transfer('sender-id', 'destinatario@email.com', 5000),
      ).rejects.toThrow(NotFoundException);

      expect(tx.user.findFirst).not.toHaveBeenCalled();
    });

    it('should find recipient using CPF', async () => {
      tx.wallet.findUnique
        .mockResolvedValueOnce({ id: 'sender-wallet' })
        .mockResolvedValueOnce({ id: 'recipient-wallet' });

      tx.user.findFirst.mockResolvedValue({ id: 'recipient-id' });
      tx.wallet.updateMany.mockResolvedValue({ count: 1 });
      tx.wallet.update.mockResolvedValue({});
      tx.transaction.create.mockResolvedValue({ id: 'transaction-id' });

      await service.transfer(
        'sender-id',
        '12345678901',
        5000,
      );

      expect(tx.user.findFirst).toHaveBeenCalledWith({
        select: {
          id: true,
        },
        where: {
          OR: [
            { email: '12345678901' },
            { cpf: '12345678901' },
          ],
        },
      });
    });

    it('should find recipient using wallet UUID', async () => {
      tx.wallet.findUnique
        .mockResolvedValueOnce({ id: 'sender-wallet' })
        .mockResolvedValueOnce({ id: 'recipient-wallet' });

      tx.user.findFirst.mockResolvedValue(null);
      tx.wallet.updateMany.mockResolvedValue({ count: 1 });
      tx.wallet.update.mockResolvedValue({});
      tx.transaction.create.mockResolvedValue({ id: 'transaction-id' });

      await service.transfer(
        'sender-id',
        '123e4567-e89b-12d3-a456-426614174000',
        5000,
      );

      expect(tx.wallet.findUnique).toHaveBeenNthCalledWith(2, {
        select: {
          id: true,
        },
        where: {
          id: '123e4567-e89b-12d3-a456-426614174000',
        },
      });
    });

    it('should throw NotFoundException when recipient does not exist', async () => {
      tx.wallet.findUnique.mockResolvedValueOnce({ id: 'sender-wallet' });
      tx.user.findFirst.mockResolvedValue(null);

      await expect(
        service.transfer('sender-id', 'inexistente@email.com', 5000),
      ).rejects.toThrow(NotFoundException);

      expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when transferring to own wallet', async () => {
      tx.wallet.findUnique
        .mockResolvedValueOnce({ id: 'same-wallet' })
        .mockResolvedValueOnce({ id: 'same-wallet' });

      tx.user.findFirst.mockResolvedValue({ id: 'sender-id' });

      await expect(
        service.transfer('sender-id', 'proprio@email.com', 5000),
      ).rejects.toThrow(BadRequestException);

      expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when balance is insufficient', async () => {
      tx.wallet.findUnique
        .mockResolvedValueOnce({ id: 'sender-wallet' })
        .mockResolvedValueOnce({ id: 'recipient-wallet' });

      tx.user.findFirst.mockResolvedValue({ id: 'recipient-id' });
      tx.wallet.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.transfer('sender-id', 'destinatario@email.com', 5000),
      ).rejects.toThrow(BadRequestException);

      expect(tx.wallet.update).not.toHaveBeenCalled();
      expect(tx.transaction.create).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
