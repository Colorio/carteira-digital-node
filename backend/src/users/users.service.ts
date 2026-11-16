import * as bcrypt from 'bcrypt';
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: createUserDto.email },
          { cpf: createUserDto.cpf },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('E-mail ou CPF já cadastrado.');
    }

    const password = await bcrypt.hash(createUserDto.password, 10);

    await this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        cpf: createUserDto.cpf,
        password,
        wallet: {
          create: {},
        },
      },
    });

    return this.authService.login({
      email: createUserDto.email,
      password: createUserDto.password,
    });
  }
}
