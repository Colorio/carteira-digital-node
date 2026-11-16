import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

describe('UsersController', () => {
  let controller: UsersController;

  let usersService: {
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    usersService = {
      create: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call UsersService.create with the provided data', async () => {
    const createUserDto = {
      name: 'Teste',
      email: 'teste@email.com',
      cpf: '52998224725',
      password: '12345678',
    };

    const response = {
      id: 'user-id',
      name: createUserDto.name,
      email: createUserDto.email,
      cpf: createUserDto.cpf,
    };

    usersService.create.mockResolvedValue(response);

    const result = await controller.create(createUserDto);

    expect(result).toEqual(response);
    expect(usersService.create).toHaveBeenCalledWith(createUserDto);
  });
});
