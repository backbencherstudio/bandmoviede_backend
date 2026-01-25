import { IsBoolean, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateTicketUsageDto {
  @IsNotEmpty()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  used: boolean;
}
