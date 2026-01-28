import { Module } from '@nestjs/common';
import { OverviewService } from './overview.service';
import { OverviewController } from './overview.controller';
import { OwnerModule } from '../owner/owner.module';

@Module({
  imports: [OwnerModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
