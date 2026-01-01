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

export class TicketCheckoutItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ticket_id: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateTicketCheckoutDto {
  @ApiProperty({ type: [TicketCheckoutItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketCheckoutItemDto)
  items: TicketCheckoutItemDto[];
}

export class UpdateTicketCheckoutDto {
  @ApiProperty({ type: [TicketCheckoutItemDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TicketCheckoutItemDto)
  items?: TicketCheckoutItemDto[];
}
