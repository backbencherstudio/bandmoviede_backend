import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateCoinDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  price: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  coin_amount: number;
}
