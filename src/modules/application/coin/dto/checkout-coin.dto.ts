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

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
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
