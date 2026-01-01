import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { CoinModule } from './coin/coin.module';
import { TicketModule } from './ticket/ticket.module';
import { OrderModule } from './order/order.module';

@Module({
  imports: [NotificationModule, ContactModule, FaqModule, CoinModule, TicketModule, OrderModule],
})
export class ApplicationModule {}
