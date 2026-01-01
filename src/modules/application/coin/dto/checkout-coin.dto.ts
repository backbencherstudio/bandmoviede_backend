import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
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
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sugo_id: string;

  @ApiProperty({ type: [CoinItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoinItemDto)
  items: CoinItemDto[];
}
