import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import request from 'supertest';import { randomInt, randomUUID } from 'node:crypto';

let cpfSequence = 0;

export async function createTestApp(): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.init();

  return app;
}

export function getPrisma(app: INestApplication) {
  return app.get(PrismaService);
}

function generateCpf(): string {
  const digits = Array.from({ length: 9 }, () => randomInt(0, 10));

  if (digits.every((digit) => digit === digits[0])) {
    return generateCpf();
  }

  const calculateDigit = (length: number) => {
    const sum = digits
      .slice(0, length)
      .reduce(
        (total, digit, index) => total + digit * (length + 1 - index),
        0,
      );

    const remainder = (sum * 10) % 11;

    return remainder === 10 ? 0 : remainder;
  };

  digits.push(calculateDigit(9));
  digits.push(calculateDigit(10));

  return digits.join('');
}

export async function createTestAccount(app: INestApplication) {
  const identifier = randomUUID().replaceAll('-', '');
  const email = `teste-${identifier}@email.com`;
  const cpf = generateCpf();
  const password = '12345678';

  const registration = await request(app.getHttpServer())
    .post('/users')
    .send({
      name: 'Usuário de teste',
      email,
      cpf,
      password,
    })
    .expect(201);

  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email,
      password,
    })
    .expect(201);

  const wallet = await request(app.getHttpServer())
    .get('/wallets')
    .set('Authorization', `Bearer ${login.body.access_token}`)
    .expect(200);

  return {
    id: registration.body.user.id,
    email,
    cpf,
    password,
    token: login.body.access_token,
    walletId: wallet.body.id,
  };
}

export function authenticatedRequest(
  app: INestApplication,
  token: string,
) {
  return {
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`),

    post: (url: string, body?: object) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
  };
}
