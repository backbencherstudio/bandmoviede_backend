import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsIn } from 'class-validator';

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

export class FindAllOrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['COIN', 'TICKET'])
  type?: 'COIN' | 'TICKET';

  @IsOptional()
  @IsIn(['all', 'this_month', 'last_month', 'this_year', 'last_year'])
  filter?: 'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year';
}
