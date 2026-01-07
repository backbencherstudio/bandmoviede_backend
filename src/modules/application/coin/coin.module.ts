import { Module } from '@nestjs/common';
import { CoinService } from './coin.service';
import { CoinController } from './coin.controller';

import { OwnerModule } from 'src/modules/admin/owner/owner.module';

@Module({
  imports: [OwnerModule],
  controllers: [CoinController],
  providers: [CoinService],
})
export class CoinModule {}
