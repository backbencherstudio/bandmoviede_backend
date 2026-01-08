import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
  IsOptional,
} from 'class-validator';

export class TicketItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ticket_id: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CheckoutTicketDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  checkout_id?: string;

  @ApiProperty({ type: [TicketItemDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketItemDto)
  @IsOptional()
  items?: TicketItemDto[];
}
