import { Test, TestingModule } from '@nestjs/testing';
import { WalletsController } from './wallets.controller.js';
import { WalletsService } from './wallets.service.js';

describe('WalletsController', () => {
  let controller: WalletsController;

  let walletsService: {
    findByUserId: ReturnType<typeof vi.fn>;
    deposit: ReturnType<typeof vi.fn>;
    transfer: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    walletsService = {
      findByUserId: vi.fn(),
      deposit: vi.fn(),
      transfer: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
      providers: [
        {
          provide: WalletsService,
          useValue: walletsService,
        },
      ],
    }).compile();

    controller = module.get<WalletsController>(WalletsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return the authenticated user wallet', async () => {
    const request = {
      user: {
        userId: 'user-id',
        email: 'teste@email.com',
      },
    } as any;

    const wallet = {
      id: 'wallet-id',
      balance: 10000,
      createdAt: new Date(),
    };

    walletsService.findByUserId.mockResolvedValue(wallet);

    const result = await controller.findMyWallet(request);

    expect(result).toEqual(wallet);
    expect(walletsService.findByUserId).toHaveBeenCalledWith('user-id');
  });

  it('should deposit into the authenticated user wallet', async () => {
    const request = {
      user: {
        userId: 'user-id',
        email: 'teste@email.com',
      },
    } as any;

    const depositDto = {
      amount: 5000,
    };

    const wallet = {
      id: 'wallet-id',
      balance: 15000,
      updatedAt: new Date(),
    };

    walletsService.deposit.mockResolvedValue(wallet);

    const result = await controller.deposit(request, depositDto);

    expect(result).toEqual(wallet);
    expect(walletsService.deposit).toHaveBeenCalledWith('user-id', 5000);
  });

  it('should transfer from the authenticated user wallet', async () => {
    const request = {
      user: {
        userId: 'user-id',
        email: 'teste@email.com',
      },
    } as any;

    const transferDto = {
      recipient: 'destinatario@email.com',
      amount: 3000,
    };

    const transaction = {
      id: 'transaction-id',
      type: 'TRANSFER',
      amount: 3000,
    };

    walletsService.transfer.mockResolvedValue(transaction);

    const result = await controller.transfer(request, transferDto);

    expect(result).toEqual(transaction);
    expect(walletsService.transfer).toHaveBeenCalledWith(
      'user-id',
      'destinatario@email.com',
      3000,
    );
  });
});
