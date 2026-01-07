import { Module } from '@nestjs/common';
import { OwnerService } from './owner.service';
import { OwnerController } from './owner.controller';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';

@Module({
  controllers: [OwnerController],
  providers: [OwnerService, NotificationRepository],
  exports: [OwnerService],
})
export class OwnerModule {}
