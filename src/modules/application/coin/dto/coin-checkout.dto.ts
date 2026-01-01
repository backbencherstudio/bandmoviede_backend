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

export class CoinCheckoutItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bundle_id: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateCoinCheckoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sugo_id: string;

  @ApiProperty({ type: [CoinCheckoutItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoinCheckoutItemDto)
  items: CoinCheckoutItemDto[];
}

export class UpdateCoinCheckoutDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sugo_id?: string;

  @ApiProperty({ type: [CoinCheckoutItemDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CoinCheckoutItemDto)
  items?: CoinCheckoutItemDto[];
}
