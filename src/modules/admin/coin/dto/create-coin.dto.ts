import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCoinDto {
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  @Min(0, { message: 'Price must be at least 0' })
  @IsInt()
  price: number;

  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(750, { message: 'Coin amount must be at least 750' })
  coin_amount: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean;
}
