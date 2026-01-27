import { Module } from '@nestjs/common';
import { MailModule } from 'src/mail/mail.module';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';

@Module({
  imports: [MailModule],
  controllers: [StripeController],
  providers: [StripeService],
})
export class StripeModule {}
