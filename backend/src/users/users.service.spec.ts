import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let authService: {
    login: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };

    authService = {
      login: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user with a hashed password and wallet', async () => {
    const createUserDto = {
      name: 'Teste',
      email: 'teste@email.com',
      cpf: '52998224725',
      password: '12345678',
    };

    const createdUser = {
      id: 'user-id',
      name: createUserDto.name,
      email: createUserDto.email,
      cpf: createUserDto.cpf,
      createdAt: new Date(),
    };

    const authResponse = {
      access_token: 'jwt-token',
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
      },
    };

    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser);
    authService.login.mockResolvedValue(authResponse);

    const result = await service.create(createUserDto);

    expect(result).toEqual(authResponse);
    expect(prisma.user.create).toHaveBeenCalled();

    const createData = prisma.user.create.mock.calls[0][0].data;

    expect(createData.wallet).toEqual({
      create: {},
    });

    expect(createData.password).not.toBe(createUserDto.password);

    expect(authService.login).toHaveBeenCalledWith({
      email: createUserDto.email,
      password: createUserDto.password,
    });
  });

  it('should throw ConflictException when email or CPF already exists', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'existing-user',
    });

    await expect(
      service.create({
        name: 'Teste',
        email: 'teste@email.com',
        cpf: '52998224725',
        password: '12345678',
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(authService.login).not.toHaveBeenCalled();
  });
});
