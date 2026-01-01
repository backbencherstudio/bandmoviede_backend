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
  @ApiProperty({ type: [TicketItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketItemDto)
  items: TicketItemDto[];
}
