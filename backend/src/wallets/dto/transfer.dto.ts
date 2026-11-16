import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  recipient: string;

  @IsInt()
  @Min(1)
  @Max(2_000_000)
  amount: number;
}