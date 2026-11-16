import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';

vi.mock('bcrypt', () => ({
  compare: vi.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let service: AuthService;

  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  let jwtService: {
    signAsync: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
      },
    };

    jwtService = {
      signAsync: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should authenticate a user with valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      name: 'Teste',
      email: 'teste@email.com',
      password: '$2b$10$abcdefghijklmnopqrstuv',
    });

    vi.mocked(bcrypt.compare).mockImplementation(async () => true);
    jwtService.signAsync.mockResolvedValue('jwt-token');

    const result = await service.login({
      email: 'teste@email.com',
      password: '12345678',
    });

    expect(result).toEqual({
      access_token: 'jwt-token',
      user: {
        id: 'user-id',
        name: 'Teste',
        email: 'teste@email.com',
      },
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-id',
      name: 'Teste',
      email: 'teste@email.com',
    });
  });

  it('should throw UnauthorizedException when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'inexistente@email.com',
        password: '12345678',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});