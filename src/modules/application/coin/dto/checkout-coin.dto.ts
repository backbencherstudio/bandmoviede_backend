import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CoinItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bundle_id: string;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity: number = 1;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  coin_amount?: number;
}

export class CheckoutCoinDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  checkout_id?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sugo_id?: string;

  @ApiProperty({ type: [CoinItemDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoinItemDto)
  @IsOptional()
  items?: CoinItemDto[];
}
