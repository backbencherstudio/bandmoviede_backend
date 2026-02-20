import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { CoinModule } from './coin/coin.module';
import { TicketModule } from './ticket/ticket.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    NotificationModule,
    ContactModule,
    FaqModule,
    CoinModule,
    TicketModule,
    OrderModule,
    PaymentModule,
  ],
})
export class ApplicationModule {}
