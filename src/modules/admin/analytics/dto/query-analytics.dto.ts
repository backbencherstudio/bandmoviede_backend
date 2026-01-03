import { IsNumber, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  page?: number = 1;
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  limit?: number = 10;
}
