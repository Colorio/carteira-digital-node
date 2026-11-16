import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { IsCpf } from '../../common/validators/is-cpf.validator.js';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsCpf()
  cpf: string;

  @IsString()
  @Length(8, 100)
  password: string;
}