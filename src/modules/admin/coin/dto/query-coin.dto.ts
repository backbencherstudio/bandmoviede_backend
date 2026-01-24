import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsNumber, IsIn } from 'class-validator';

export class FindAllQueryDto {
  @IsOptional()
  @IsString()
  search: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  page: number;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  limit: number;

  @IsOptional()
  @IsIn(['all', 'this_month', 'last_month', 'this_year', 'last_year'])
  filter?: 'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year';
}
