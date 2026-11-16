import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

describe('TransactionsController', () => {
  let controller: TransactionsController;

  let transactionsService: {
    findAllByUserId: ReturnType<typeof vi.fn>;
    reverse: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    transactionsService = {
      findAllByUserId: vi.fn(),
      reverse: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: transactionsService,
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return the authenticated user transactions', async () => {
    const request = {
      user: {
        userId: 'user-id',
        email: 'teste@email.com',
      },
    } as any;

    const transactions = {
      data: [],
      meta: {
        total: 0,
        per_page: 10,
        current_page: 1,
        last_page: 0,
      },
    };

    transactionsService.findAllByUserId.mockResolvedValue(transactions);

    const result = await controller.findAll(request, 1, 10);

    expect(result).toEqual(transactions);
    expect(transactionsService.findAllByUserId).toHaveBeenCalledWith(
      'user-id',
      1,
      10,
    );
  });

  it('should reverse a transaction', async () => {
    const request = {
      user: {
        userId: 'user-id',
        email: 'teste@email.com',
      },
    } as any;

    const transactionId = 'transaction-id';

    const reversal = {
      id: 'reversal-id',
      type: 'REVERSAL',
      reversesTransactionId: transactionId,
    };

    transactionsService.reverse.mockResolvedValue(reversal);

    const result = await controller.reverse(request, transactionId);

    expect(result).toEqual(reversal);
    expect(transactionsService.reverse).toHaveBeenCalledWith(
      'user-id',
      transactionId,
    );
  });
});
