import { IsOptional } from 'class-validator';

export class FindAllOrderQueryDto {
  @IsOptional()
  page: number;
  @IsOptional()
  limit: number;
}
