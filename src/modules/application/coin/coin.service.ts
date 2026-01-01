import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { FindAllQueryDto } from './dto/query-coin.dto';
import { CheckoutCoinDto } from './dto/checkout-coin.dto';
import {
  CreateCoinCheckoutDto,
  UpdateCoinCheckoutDto,
} from './dto/coin-checkout.dto';
import { TransactionRepository } from 'src/common/repository/transaction/transaction.repository';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import { StringHelper } from 'src/common/helper/string.helper';

@Injectable()
export class CoinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionRepository: TransactionRepository,
  ) {}

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

  async createCoinOrder(
    userId: string,
    bundleId: string,
    sugo_id: string,
    quantity?: number,
  ) {
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
        amount: coinBundle.price * (quantity || 1),
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
        amount: coinBundle.price * (quantity || 1),
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
          amount: coinBundle.price * (quantity || 1),
          quantity: quantity || 1,
          status: 'pending',
          transaction_id: transaction.id,
          sugo_id: sugo_id,
        },
      });

      // Update transaction with coin order id if needed, but the schema has transaction_id in CoinOrder,
      // and PaymentTransaction has coinOrders relation. So we are good.
      // However, my updated Repository has 'order_id' which is a string field in PaymentTransaction.
      // I can put coinOrder.id there if I want validation.
      // But I will skip that circular update for now to keep it simple, as the relation is established via `transaction_id` in CoinOrder.

      return {
        success: true,
        message: 'Coin order created successfully',
        // data: {
        //   client_secret: paymentIntent.client_secret,
        //   order_id: coinOrder.id,
        // },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create coin order',
      };
    }
  }

  async checkout(userId: string, body: CheckoutCoinDto) {
    try {
      if (!body.items || body.items.length === 0) {
        throw new BadRequestException('No coin bundles provided');
      }

      // 1. Validate all bundles and calculate total amount
      let totalAmount = 0;
      const bundleDetails = [];

      for (const item of body.items) {
        const bundle = await this.prisma.coinBundle.findUnique({
          where: { id: item.bundle_id, status: 'Active' },
        });

        if (!bundle) {
          throw new BadRequestException(
            `Coin bundle not found or inactive: ${item.bundle_id}`,
          );
        }

        totalAmount += bundle.price * item.quantity;
        bundleDetails.push({ bundle, quantity: item.quantity });
      }

      // 2. Get User and Stripe Customer
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      let stripeCustomerId = user.billing_id;
      if (!stripeCustomerId) {
        const customer = await StripePayment.createCustomer({
          user_id: user.id,
          name: user.name,
          email: user.email,
        });
        stripeCustomerId = customer.id;

        await this.prisma.user.update({
          where: { id: user.id },
          data: { billing_id: stripeCustomerId },
        });
      }

      // 3. Create Payment Intent
      const paymentIntent = await StripePayment.createPaymentIntent({
        amount: totalAmount,
        currency: 'usd',
        customer_id: stripeCustomerId,
        metadata: {
          type: 'coin_checkout',
          user_id: userId,
          bundle_count: body.items.length.toString(),
        },
      });

      // 4. Create Transaction and Orders in a Prisma Transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create Transaction Record
        const transaction = await this.transactionRepository.createTransaction(
          {
            order_id: null,
            amount: totalAmount,
            currency: 'usd',
            reference_number: paymentIntent.id,
            status: 'pending',
            type: 'coin_checkout',
          },
          prisma,
        );

        const createdOrders = [];

        for (const item of bundleDetails) {
          // Update bundle sold count
          await prisma.coinBundle.update({
            where: { id: item.bundle.id },
            data: { total_sold: { increment: item.quantity } },
          });

          // Create coin order
          const order = await prisma.coinOrder.create({
            data: {
              user_id: userId,
              coin_bundle_id: item.bundle.id,
              amount: item.bundle.price * item.quantity,
              quantity: item.quantity,
              status: 'pending',
              transaction_id: transaction.id,
              sugo_id: body.sugo_id,
            },
          });
          createdOrders.push(order);
        }

        return { transaction, createdOrders };
      });

      return {
        success: true,
        message: 'Oder payment successful',
        // data: {
        //   client_secret: paymentIntent.client_secret,
        //   transaction_id: result.transaction.id,
        //   orders: result.createdOrders.map((o) => o.id),
        // },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      return {
        success: false,
        message: 'Failed to process checkout',
      };
    }
  }

  async createCheckoutDraft(userId: string, body: CreateCoinCheckoutDto) {
    try {
      // Optional: Validate bundles exist
      for (const item of body.items) {
        const bundle = await this.prisma.coinBundle.findUnique({
          where: { id: item.bundle_id },
        });
        if (!bundle)
          throw new BadRequestException(`Invalid bundle id: ${item.bundle_id}`);
      }

      const draft = await this.prisma.coinCheckout.create({
        data: {
          user_id: userId,
          sugo_id: body.sugo_id,
          items: {
            create: body.items.map((item) => ({
              coin_bundle_id: item.bundle_id,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              coin_bundle: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Checkout draft created',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create checkout draft',
      };
    }
  }

  async getCheckoutDrafts(userId: string) {
    try {
      const drafts = await this.prisma.coinCheckout.findMany({
        where: { user_id: userId },
        include: {
          items: {
            include: {
              coin_bundle: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return {
        success: true,
        message: 'Checkout drafts found',
        data: drafts,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get checkout drafts',
      };
    }
  }

  async getCheckoutDraft(userId: string, id: string) {
    try {
      const draft = await this.prisma.coinCheckout.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              coin_bundle: true,
            },
          },
        },
      });

      if (!draft || draft.user_id !== userId) {
        throw new NotFoundException('Draft not found');
      }

      return {
        success: true,
        message: 'Draft found',
        data: draft,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get checkout draft',
      };
    }
  }

  async updateCheckoutDraft(
    userId: string,
    id: string,
    body: UpdateCoinCheckoutDto,
  ) {
    try {
      const draft = await this.prisma.coinCheckout.findUnique({
        where: { id },
      });

      if (!draft || draft.user_id !== userId) {
        throw new NotFoundException('Draft not found');
      }

      const updateData: any = {};
      if (body.sugo_id) updateData.sugo_id = body.sugo_id;

      if (body.items) {
        // Replace items logic: delete old, create new
        updateData.items = {
          deleteMany: {},
          create: body.items.map((item) => ({
            coin_bundle_id: item.bundle_id,
            quantity: item.quantity,
          })),
        };
      }

      const updatedDraft = await this.prisma.coinCheckout.update({
        where: { id },
        data: updateData,
        include: {
          items: {
            include: {
              coin_bundle: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Draft updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update checkout draft',
      };
    }
  }

  async deleteCheckoutDraft(userId: string, id: string) {
    try {
      const draft = await this.prisma.coinCheckout.findUnique({
        where: { id },
      });

      if (!draft || draft.user_id !== userId) {
        throw new NotFoundException('Draft not found');
      }

      await this.prisma.coinCheckout.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Draft deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete checkout draft',
      };
    }
  }
}
