import { IsEnum, IsOptional } from 'class-validator';

export enum Period {
  lastYear = 'lastYear',
  lastThreeMonth = 'lastThreeMonth',
  lastMonth = 'lastMonth',
  lastSevenDay = 'lastSevenDay',
}
export class SalesAnalyticsQueryDto {
  @IsOptional()
  @IsEnum(Period)
  period?: Period;
}
