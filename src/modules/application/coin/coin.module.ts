import { Module } from '@nestjs/common';
import { CoinService } from './coin.service';
import { CoinController } from './coin.controller';

@Module({
  controllers: [CoinController],
  providers: [CoinService],
})
export class CoinModule {}
