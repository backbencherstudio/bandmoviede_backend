import { Transform } from 'class-transformer';
import { IsOptional, IsNumber } from 'class-validator';

export class FindAllQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  page: number;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  limit: number;
}
