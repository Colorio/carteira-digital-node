import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;

  let authService: {
    login: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authService = {
      login: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call AuthService.login with the provided credentials', async () => {
    const loginDto = {
      email: 'teste@email.com',
      password: '12345678',
    };

    const response = {
      access_token: 'jwt-token',
    };

    authService.login.mockResolvedValue(response);

    const result = await controller.login(loginDto);

    expect(result).toEqual(response);
    expect(authService.login).toHaveBeenCalledWith(loginDto);
  });
});
