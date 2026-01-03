import { IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  page: number;
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  limit: number;
}

export class FindAllOrderQueryDto extends PaginationQueryDto {}

export enum EventTicketStatus {
  Active = 'Active',
  Inactive = 'Inactive',
}

export class FindEventTicketsQueryDto extends PaginationQueryDto {
  @IsOptional()
  status?: EventTicketStatus;
}
