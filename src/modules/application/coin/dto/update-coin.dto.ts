import { PartialType } from '@nestjs/swagger';
import { CreateCoinDto } from './create-coin.dto';

export class UpdateCoinDto extends PartialType(CreateCoinDto) {}
