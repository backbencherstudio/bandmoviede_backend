import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { FindAllQueryDto } from './dto/query-coin.dto';
import { TransactionRepository } from 'src/common/repository/transaction/transaction.repository';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';

@Injectable()
export class CoinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionRepository: TransactionRepository,
  ) { }

  async findAllCoinBundle(query: FindAllQueryDto) {
    const [coinBundles, total] = await Promise.all([
      this.prisma.coinBundle.findMany({
        where: {
          status: 'Active',
        },
        select: {
          id: true,
          name: true,
          price: true,
          thumbnail: true,
          coin_amount: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.coinBundle.count(),
    ]);

    const data = coinBundles.map((bundle) => {
      return {
        ...bundle,
        thumbnail_url: bundle.thumbnail
          ? SojebStorage.url(
            appConfig().storageUrl.coinThumbnails + bundle.thumbnail,
          )
          : null,
      };
    });

    return {
      success: coinBundles.length > 0 ? true : false,
      message:
        coinBundles.length > 0
          ? 'Coin bundle retrieved successfully'
          : 'No coin bundle found',
      data: data,
      meta_data: {
        total: total || 0,
        page: query.page,
        limit: query.limit,
      },
    };
  }

  async findCoinBundleById(id: string) {
    if (!id) {
      throw new BadRequestException('Coin bundle id is required');
    }
    const coinBundle = await this.prisma.coinBundle.findUnique({
      where: {
        id: id,
        status: 'Active',
      },
      select: {
        id: true,
        name: true,
        price: true,
        thumbnail: true,
        coin_amount: true,
      },
    });

    if (!coinBundle) {
      throw new NotFoundException('Coin bundle not found');
    }

    const thumbnail_url = coinBundle.thumbnail
      ? SojebStorage.url(
        appConfig().storageUrl.coinThumbnails + coinBundle.thumbnail,
      )
      : null;

    return {
      success: true,
      message: 'Coin bundle retrieved successfully',
      data: { ...coinBundle, thumbnail_url },
    };
  }

  async createCoinOrder(userId: string, bundleId: string) {
    try {
      const coinBundle = await this.prisma.coinBundle.findUnique({
        where: {
          id: bundleId,
        },
      });

      if (!coinBundle) {
        return {
          success: false,
          message: 'Coin bundle not found',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Check if user has stripe customer id
      let stripeCustomerId = user.billing_id;
      if (!stripeCustomerId) {
        const customer = await StripePayment.createCustomer({
          user_id: user.id,
          name: user.name,
          email: user.email,
        });
        stripeCustomerId = customer.id;

        await this.prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            billing_id: stripeCustomerId,
          },
        });
      }

      // Create payment intent
      const paymentIntent = await StripePayment.createPaymentIntent({
        amount: coinBundle.price,
        currency: 'usd',
        customer_id: stripeCustomerId,
        metadata: {
          type: 'coin_order',
          user_id: userId,
          bundle_id: bundleId,
        },
      });

      // Create transaction
      const transaction = await this.transactionRepository.createTransaction({
        order_id: null, // Will update later or keep null as it's not a generic order yet? 
        // actually for now I will pass null and link it in CoinOrder
        amount: coinBundle.price,
        currency: 'usd',
        reference_number: paymentIntent.id,
        status: 'pending',
        type: 'coin_order',
      });

      // Create coin order
      const coinOrder = await this.prisma.coinOrder.create({
        data: {
          user_id: userId,
          coin_bundle_id: bundleId,
          amount: coinBundle.price,
          status: 'pending',
          transaction_id: transaction.id,
        },
      });

      // Update transaction with coin order id if needed, but the schema has transaction_id in CoinOrder, 
      // and PaymentTransaction has coinOrders relation. So we are good.
      // However, my updated Repository has 'order_id' which is a string field in PaymentTransaction.
      // I can put coinOrder.id there if I want validation.
      // But I will skip that circular update for now to keep it simple, as the relation is established via `transaction_id` in CoinOrder.

      return {
        success: true,
        data: {
          client_secret: paymentIntent.client_secret,
          order_id: coinOrder.id
        },
      };

    } catch (error) {
      console.log(error);
      return {
        success: false,
        message: 'Failed to create coin order',
      };
    }
  }
}

