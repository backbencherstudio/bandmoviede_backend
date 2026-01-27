import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';

@Module({
  controllers: [TicketController],
  providers: [TicketService, NotificationRepository],
})
export class TicketModule {}
