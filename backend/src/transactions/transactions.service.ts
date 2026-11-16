import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUserId(userId: string, page = 1, limit = 10) {
    const currentPage = Math.max(1, page);
    const perPage = Math.min(100, Math.max(1, limit));
    const skip = (currentPage - 1) * perPage;

    const wallet = await this.prisma.wallet.findUnique({
      select: {
        id: true,
      },
      where: {
        userId,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada.');
    }

    const [entries, total] = await Promise.all([
      this.prisma.walletEntry.findMany({
        select: {
          id: true,
          amount: true,
          createdAt: true,
          transaction: {
            select: {
              id: true,
              type: true,
              status: true,
              amount: true,
              createdAt: true,
              entries: {
                select: {
                  walletId: true,
                  wallet: {
                    select: {
                      user: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        where: {
          walletId: wallet.id,
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip,
        take: perPage,
      }),
      this.prisma.walletEntry.count({
        where: {
          walletId: wallet.id,
        },
      }),
    ]);

    const data = entries.map((entry) => {
      const counterpartyEntry = entry.transaction.entries.find(
        (transactionEntry) => transactionEntry.walletId !== wallet.id,
      );

      return {
        id: entry.id,
        transaction_id: entry.transaction.id,
        type: entry.transaction.type,
        status: entry.transaction.status,
        direction: entry.amount >= 0 ? 'credit' : 'debit',
        amount: Math.abs(entry.amount).toString(),
        created_at: entry.createdAt,
        counterparty: counterpartyEntry
          ? counterpartyEntry.wallet.user
          : null,
      };
    });

    return {
      data,
      pagination: {
        total,
        per_page: perPage,
        current_page: currentPage,
        last_page: Math.ceil(total / perPage),
      },
    };
  }

  async reverse(userId: string, transactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          createdAt: true,
          reversesTransactionId: true,
          entries: {
            select: {
              walletId: true,
              amount: true,
              wallet: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
        where: {
          id: transactionId,
        },
      });

      if (!transaction) {
        throw new NotFoundException('Transação não encontrada.');
      }

      if (
        transaction.status !== 'COMPLETED' ||
        transaction.reversesTransactionId
      ) {
        throw new BadRequestException(
          'Esta transação não pode ser estornada.',
        );
      }

      if (!['DEPOSIT', 'TRANSFER'].includes(transaction.type)) {
        throw new BadRequestException(
          'Este tipo de transação não pode ser estornado.',
        );
      }

      const isOwner = transaction.entries.some(
        (entry) => entry.wallet.userId === userId && entry.amount < 0,
      ) || (
        transaction.type === 'DEPOSIT' &&
        transaction.entries.some((entry) => entry.wallet.userId === userId)
      );

      if (!isOwner) {
        throw new NotFoundException('Transação não encontrada.');
      }

      if (transaction.type === 'TRANSFER') {
        const fiveMinutes = 5 * 60 * 1000;
        const elapsedTime = Date.now() - transaction.createdAt.getTime();

        if (elapsedTime > fiveMinutes) {
          throw new BadRequestException(
            'O prazo para estornar uma transferência é de 5 minutos.',
          );
        }
      }

      const updated = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: 'COMPLETED',
        },
        data: {
          status: 'REVERSED',
        },
      });

      if (updated.count === 0) {
        throw new ConflictException('Esta transação já foi estornada.');
      }

      if (transaction.type === 'DEPOSIT') {
        const entry = transaction.entries[0];

        const updatedWallet = await tx.wallet.updateMany({
          where: {
            id: entry.walletId,
            balance: {
              gte: entry.amount,
            },
          },
          data: {
            balance: {
              decrement: entry.amount,
            },
          },
        });

        if (updatedWallet.count === 0) {
          throw new BadRequestException(
            'Saldo insuficiente para estornar este depósito.',
          );
        }
      } else {
        for (const entry of transaction.entries) {
          await tx.wallet.update({
            where: {
              id: entry.walletId,
            },
            data: {
              balance: {
                decrement: entry.amount,
              },
            },
          });
        }
      }

      const reversal = await tx.transaction.create({
        data: {
          type: 'REVERSAL',
          amount: transaction.amount,
          reversesTransactionId: transaction.id,
          entries: {
            create: transaction.entries.map((entry) => ({
              walletId: entry.walletId,
              amount: -entry.amount,
            })),
          },
        },
        select: {
          id: true,
          type: true,
          amount: true,
          createdAt: true,
          reversesTransactionId: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          transactionId: reversal.id,
          action: 'REVERSAL',
          metadata: {
            originalTransactionId: transaction.id,
            amount: transaction.amount,
            walletIds: transaction.entries.map((entry) => entry.walletId),
          },
        },
      });

      return reversal;
    });
  }
}
