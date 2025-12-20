import { Transform } from 'class-transformer';
import { IsOptional, IsNumber } from 'class-validator';

export class FindAllQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  page: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  limit: number = 10;
}
