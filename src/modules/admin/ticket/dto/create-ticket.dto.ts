import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketStatus } from 'prisma/generated/enums';

export class CreateTicketDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  ticket_status: TicketStatus;

  @IsString()
  @IsOptional()
  about?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  included?: string[];

  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  ticket_price: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_active: boolean = true;

  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  sold_limit: number;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  event_date: Date;

  @IsNotEmpty()
  @IsString()
  location: string;
}
