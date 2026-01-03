import { Module } from '@nestjs/common';
import { FaqModule } from './faq/faq.module';
import { ContactModule } from './contact/contact.module';
import { WebsiteInfoModule } from './website-info/website-info.module';
import { PaymentTransactionModule } from './payment-transaction/payment-transaction.module';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { CoinModule } from './coin/coin.module';
import { TicketModule } from './ticket/ticket.module';
import { OverviewModule } from './overview/overview.module';
import { OrderModule } from './order/order.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    FaqModule,
    ContactModule,
    WebsiteInfoModule,
    PaymentTransactionModule,
    UserModule,
    NotificationModule,
    CoinModule,
    TicketModule,
    OverviewModule,
    OrderModule,
    AnalyticsModule,
  ],
})
export class AdminModule {}
