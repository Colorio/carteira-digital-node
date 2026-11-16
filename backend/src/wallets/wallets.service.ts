import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      select: {
        id: true,
        balance: true,
        createdAt: true,
      },
      where: {
        userId,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada.');
    }

    return wallet;
  }

  async deposit(userId: string, amount: number) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
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

      const transaction = await tx.transaction.create({
        data: {
          type: 'DEPOSIT',
          amount,
          entries: {
            create: {
              walletId: wallet.id,
              amount,
            },
          },
        },
        select: {
          id: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          transactionId: transaction.id,
          action: 'DEPOSIT',
          metadata: {
            walletId: wallet.id,
            amount,
          },
        },
      });

      return tx.wallet.update({
        select: {
          id: true,
          balance: true,
          updatedAt: true,
        },
        where: {
          id: wallet.id,
        },
        data: {
          balance: {
            increment: amount,
          },
        },
      });
    });
  }

  async transfer(userId: string, recipient: string, amount: number) {
    return this.prisma.$transaction(async (tx) => {
      const senderWallet = await tx.wallet.findUnique({
        select: {
          id: true,
        },
        where: {
          userId,
        },
      });

      if (!senderWallet) {
        throw new NotFoundException('Carteira de origem não encontrada.');
      }

      const normalizedRecipient = recipient.replace(/\D/g, '');
      const isCpf = /^\d{11}$/.test(normalizedRecipient);

      const recipientUser = await tx.user.findFirst({
        select: {
          id: true,
        },
        where: {
          OR: [
            { email: recipient },
            ...(isCpf ? [{ cpf: normalizedRecipient }] : []),
          ],
        },
      });

      let recipientWallet = recipientUser
        ? await tx.wallet.findUnique({
            select: {
              id: true,
            },
            where: {
              userId: recipientUser.id,
            },
          })
        : null;

      if (
        !recipientWallet &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipient)
      ) {
        recipientWallet = await tx.wallet.findUnique({
          select: {
            id: true,
          },
          where: {
            id: recipient,
          },
        });
      }

      if (!recipientWallet) {
        throw new NotFoundException('Destinatário não encontrado.');
      }

      if (senderWallet.id === recipientWallet.id) {
        throw new BadRequestException(
          'Não é possível transferir para sua própria carteira.',
        );
      }

      const debit = await tx.wallet.updateMany({
        where: {
          id: senderWallet.id,
          balance: {
            gte: amount,
          },
        },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });

      if (debit.count === 0) {
        throw new BadRequestException('Saldo insuficiente.');
      }

      await tx.wallet.update({
        where: {
          id: recipientWallet.id,
        },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          type: 'TRANSFER',
          amount,
          entries: {
            create: [
              {
                walletId: senderWallet.id,
                amount: -amount,
              },
              {
                walletId: recipientWallet.id,
                amount,
              },
            ],
          },
        },
        select: {
          id: true,
          type: true,
          amount: true,
          createdAt: true,
          entries: {
            select: {
              walletId: true,
              amount: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          transactionId: transaction.id,
          action: 'TRANSFER',
          metadata: {
            senderWalletId: senderWallet.id,
            recipientWalletId: recipientWallet.id,
            amount,
          },
        },
      });

      return transaction;
    });
  }
}