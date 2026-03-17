import { Module } from '@nestjs/common';
import { PaypalController } from './paypal/paypal.controller';
import { TransactionRepository } from 'src/common/repository/transaction/transaction.repository';
import { CoinModule } from '../coin/coin.module';

@Module({
  imports: [CoinModule],
  controllers: [PaypalController],
  providers: [TransactionRepository],
})
export class PaymentModule {}
