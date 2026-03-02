import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateCoinDto {
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  @Min(0, { message: 'Price must be at least 0' })
  @IsNumber()
  price: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  coin_amount: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_custom?: boolean;
}
