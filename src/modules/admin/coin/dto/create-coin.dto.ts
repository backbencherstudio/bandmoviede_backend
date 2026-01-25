import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCoinDto {
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  @IsInt()
  price: number;

  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  @IsInt()
  coin_amount: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_active?: boolean;
}
