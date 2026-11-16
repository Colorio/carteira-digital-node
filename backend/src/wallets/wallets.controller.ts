import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { WalletsService } from './wallets.service.js';
import { DepositDto } from './dto/deposit.dto.js';
import { TransferDto } from './dto/transfer.dto.js';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  findMyWallet(@Req() request: AuthenticatedRequest) {
    return this.walletsService.findByUserId(request.user.userId);
  }

  @Post('deposit')
  deposit(
    @Req() request: AuthenticatedRequest,
    @Body() depositDto: DepositDto,
  ) {
    return this.walletsService.deposit(
      request.user.userId,
      depositDto.amount,
    );
  }

  @Post('transfer')
  transfer(
    @Req() request: AuthenticatedRequest,
    @Body() transferDto: TransferDto,
  ) {
    return this.walletsService.transfer(
      request.user.userId,
      transferDto.recipient,
      transferDto.amount,
    );
  }
}