import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateCoinDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsInt()
  price: number;

  @IsNotEmpty()
  @IsInt()
  coin_amount: number;
}
