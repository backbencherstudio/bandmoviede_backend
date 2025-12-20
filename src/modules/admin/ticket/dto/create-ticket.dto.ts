import {
  IsArray,
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTicketDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  about?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  included?: string[];

  @IsNotEmpty()
  @IsNumber()
  ticket_price: number;

  @IsOptional()
  @IsBoolean()
  is_active: boolean = true;

  @IsNotEmpty()
  @IsNumber()
  sold_limit: number;

  @IsNotEmpty()
  @IsDate()
  event_date: Date;

  @IsNotEmpty()
  @IsString()
  location: string;
}
