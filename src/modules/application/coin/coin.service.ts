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
import { OwnerService } from 'src/modules/admin/owner/owner.service';
import axios from 'axios';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class CoinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionRepository: TransactionRepository,
    private readonly ownerService: OwnerService,
    private readonly notificationRepository: NotificationRepository,
    private readonly messageGateway: MessageGateway,
    private readonly mailService: MailService,
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

  // State variables for retry mechanism
  private isSystemLocked = false;
  private retryQueue: { sugoId: string; amount: number }[] = [];
  private retryInterval: NodeJS.Timeout | null = null;
  private readonly RETRY_INTERVAL_MS = 60000; // 1 minute

  async createCoinOrder(
    userId: string,
    bundleId: string,
    sugo_id: string,
    quantity?: number,
  ) {
    // 1. Check system lock
    if (this.isSystemLocked) {
      return {
        success: false,
        message: 'System is currently unavailable to process this request',
      };
    }

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

      // Check owner balance
      const ownerCoins = await this.ownerService.findOwnerCoins();

      if (!ownerCoins.success || !ownerCoins.data?.balance) {
        const admins = await this.prisma.user.findMany({
          where: {
            type: 'admin',
          },
          select: {
            id: true,
          },
        });

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            const lowBalanceAlertPayload: any = {
              sender_id: null,
              receiver_id: admin.id,
              text: `Owner coin balance is low: ${ownerCoins.data?.balance}. Client required: ${appConfig().sugo.ownerBalanceLimit}`,
              type: 'cross_owner_coin_balance',
            };

            const hasSentToday =
              await this.notificationRepository.hasTodayNotification(
                admin.id,
                'cross_owner_coin_balance',
              );

            if (hasSentToday) {
              // console.log(
              //   `Notification already sent to user ${admin.id} today`,
              // );
              continue;
            }

            const userSocketId = this.messageGateway.clients.get(admin.id);

            if (userSocketId) {
              this.messageGateway.server
                .to(userSocketId)
                .emit('crossOwnerBalance', lowBalanceAlertPayload);
            }

            await this.notificationRepository.createNotification(
              lowBalanceAlertPayload,
            );
          }
        }

        return {
          success: false,
          message: 'Failed to fetch owner balance',
        };
      }

      const ownerBalance = parseFloat(ownerCoins.data.balance);
      const totalCoinAmount = coinBundle.coin_amount * (quantity || 1);

      if (ownerBalance < totalCoinAmount) {
        return {
          success: false,
          message: 'System is currently unavailable to process this request',
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

      // send notification to admin
      const admins = await this.prisma.user.findMany({
        where: {
          type: 'admin',
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
        },
      });

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          const coinPurchasePayload: any = {
            sender_id: null,
            receiver_id: admin.id,
            text: `client ${user.name} purchase coin bundle ${coinBundle.name}`,
            type: 'client_coin_purchase',
          };

          const userSocketId = this.messageGateway.clients.get(admin.id);

          if (userSocketId) {
            this.messageGateway.server
              .to(userSocketId)
              .emit('clientCoinPurchase', coinPurchasePayload);
          }

          await this.notificationRepository.createNotification(
            coinPurchasePayload,
          );
        }
      }

      // sent client notification
      const coinPurchasePayload: any = {
        sender_id: null,
        receiver_id: userId,
        text: `You purchase coin bundle ${coinBundle.name} successfully. ${coinBundle.coin_amount} coin added to your account very soon`,
        type: 'coin_purchase',
      };

      await this.notificationRepository.createNotification(coinPurchasePayload);
      const clientSocketId = this.messageGateway.clients.get(userId);

      if (clientSocketId) {
        this.messageGateway.server
          .to(clientSocketId)
          .emit('paymentDone', coinPurchasePayload);
      }

      // Update transaction with coin order id if needed, but the schema has transaction_id in CoinOrder,
      // and PaymentTransaction has coinOrders relation. So we are good.
      // However, my updated Repository has 'order_id' which is a string field in PaymentTransaction.
      // I can put coinOrder.id there if I want validation.
      // But I will skip that circular update for now to keep it simple, as the relation is established via `transaction_id` in CoinOrder.

      // Transfer coins to Sugo
      await this.transferCoinsToSugo(sugo_id, totalCoinAmount, userId);

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
    // 1. Check system lock
    if (this.isSystemLocked) {
      return {
        success: false,
        message: 'System is currently unavailable to process this request',
      };
    }

    try {
      let items: { bundle_id: string; quantity: number }[] = [];
      let sugo_id = body.sugo_id;

      if (body.checkout_id) {
        const draft = await this.prisma.coinCheckout.findUnique({
          where: { id: body.checkout_id },
          include: { items: true },
        });

        if (!draft || draft.user_id !== userId) {
          throw new NotFoundException('Checkout draft not found');
        }

        items = draft.items.map((item) => ({
          bundle_id: item.coin_bundle_id,
          quantity: item.quantity,
        }));
        sugo_id = draft.sugo_id;
      } else {
        if (!body.items || body.items.length === 0) {
          throw new BadRequestException('No coin bundles provided');
        }
        if (!body.sugo_id) {
          throw new BadRequestException('Sugo ID is required');
        }
        items = body.items;
      }

      // 1. Validate all bundles and calculate total amount
      let totalAmount = 0;
      let totalCoinAmount = 0;
      const bundleDetails = [];

      for (const item of items) {
        const bundle = await this.prisma.coinBundle.findUnique({
          where: { id: item.bundle_id, status: 'Active' },
        });

        if (!bundle) {
          throw new BadRequestException(
            `Coin bundle not found or inactive: ${item.bundle_id}`,
          );
        }

        totalAmount += bundle.price * item.quantity;
        totalCoinAmount += bundle.coin_amount * item.quantity;
        bundleDetails.push({ bundle, quantity: item.quantity });
      }

      // Check owner balance
      const ownerCoins = await this.ownerService.findOwnerCoins();
      if (!ownerCoins.success || !ownerCoins.data?.balance) {
        return {
          success: false,
          message: 'Failed to fetch owner balance',
        };
      }

      const ownerBalance = parseFloat(ownerCoins.data.balance);
      // console.log(ownerBalance, totalCoinAmount);
      if (ownerBalance < totalCoinAmount) {
        const admins = await this.prisma.user.findMany({
          where: {
            type: 'admin',
          },
          select: {
            id: true,
          },
        });

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            const lowBalanceAlertPayload: any = {
              sender_id: null,
              receiver_id: admin.id,
              text: `Owner coin balance is low: ${ownerBalance}. Client required: ${totalCoinAmount}`,
              type: 'cross_owner_coin_balance',
            };

            const hasSentToday =
              await this.notificationRepository.hasTodayNotification(
                admin.id,
                'cross_owner_coin_balance',
              );

            if (hasSentToday) {
              // console.log(
              //   `Notification already sent to user ${admin.id} today`,
              // );
              continue;
            }

            const userSocketId = this.messageGateway.clients.get(admin.id);

            if (userSocketId) {
              this.messageGateway.server
                .to(userSocketId)
                .emit('crossOwnerBalance', lowBalanceAlertPayload);
            }

            await this.notificationRepository.createNotification(
              lowBalanceAlertPayload,
            );
          }
        }
        return {
          success: false,
          message: 'System is currently unavailable to process this request',
        };
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
          bundle_count: items.length.toString(),
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
              sugo_id: sugo_id,
            },
          });
          createdOrders.push(order);
        }

        // Delete checkout draft if it exists
        if (body.checkout_id) {
          await prisma.coinCheckout.delete({
            where: { id: body.checkout_id },
          });
        }

        return { transaction, createdOrders };
      });

      // Transfer coins to Sugo
      await this.transferCoinsToSugo(sugo_id, totalCoinAmount, userId);

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
        select: {
          id: true,
          user_id: true,
          sugo_id: true,
          items: {
            select: {
              id: true,
              quantity: true,
              created_at: true,
              coin_bundle: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  coin_amount: true,
                  created_at: true,
                  thumbnail: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      const data = drafts.map((draft) => ({
        ...draft,
        items: draft.items.map((item) => ({
          ...item,
          coin_bundle: {
            ...item.coin_bundle,
            total_coin: item.coin_bundle.coin_amount * item.quantity,
            thumbnail_url: item.coin_bundle.thumbnail
              ? SojebStorage.url(
                  appConfig().storageUrl.coinThumbnails +
                    item.coin_bundle.thumbnail,
                )
              : null,
          },
        })),
      }));

      return {
        success: true,
        message: 'Checkout drafts found',
        data: data,
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
        select: {
          id: true,
          user_id: true,
          sugo_id: true,
          items: {
            select: {
              id: true,
              quantity: true,
              created_at: true,
              coin_bundle: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  coin_amount: true,
                  created_at: true,
                  thumbnail: true,
                },
              },
            },
          },
        },
      });

      if (!draft || draft.user_id !== userId) {
        throw new NotFoundException('Draft not found');
      }

      const data = {
        ...draft,
        items: draft.items.map((item) => ({
          ...item,
          coin_bundle: {
            ...item.coin_bundle,
            total_coin: item.coin_bundle.coin_amount * item.quantity,
            thumbnail_url: item.coin_bundle.thumbnail
              ? SojebStorage.url(
                  appConfig().storageUrl.coinThumbnails +
                    item.coin_bundle.thumbnail,
                )
              : null,
          },
        })),
      };

      return {
        success: true,
        message: 'Draft found',
        data: data,
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
      // 1. Try to find and delete as a Draft
      const draft = await this.prisma.coinCheckout.findUnique({
        where: { id },
      });

      if (draft) {
        if (draft.user_id !== userId) {
          throw new NotFoundException('Draft not found');
        }

        await this.prisma.coinCheckout.delete({
          where: { id },
        });

        return {
          success: true,
          message: 'Draft deleted successfully',
        };
      }

      // 2. If not a draft, try to find and delete as an Item
      const item = await this.prisma.coinCheckoutItem.findUnique({
        where: { id },
        include: { coin_checkout: true },
      });

      if (item) {
        if (item.coin_checkout.user_id !== userId) {
          throw new NotFoundException('Item not found');
        }

        await this.prisma.coinCheckoutItem.delete({
          where: { id },
        });

        return {
          success: true,
          message: 'Item deleted successfully',
        };
      }

      // 3. If neither, throw error
      throw new NotFoundException('Draft or Item not found');
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      return {
        success: false,
        message: 'Failed to delete checkout draft or item',
      };
    }
  }

  private async transferCoinsToSugo(
    sugoId: string,
    amount: number,
    userId: string,
  ) {
    const url = appConfig().sugo.coinTransferUrl;
    const sellerId = appConfig().sugo.ownerId;

    if (!url || !sellerId) {
      console.warn('Sugo coin transfer URL or Seller ID not configured');
      return;
    }

    try {
      const payload = {
        coin_seller_id: sellerId,
        user_id: sugoId,
        recharge_amount: amount.toString(),
        nonce: Date.now().toString(),
      };

      const result = await axios.post(url, payload);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      // Handle 80002 code: Owner balance not enough
      // {"rspHead":{"code":0, "prompt":""}, "balance":"290"}
      const responseData = result.data;
      if (responseData?.rspHead?.code === 7) {
        console.warn(
          'Owner coin balance low (Code 7). Locking system and starting retry mechanism.',
        );
        this.isSystemLocked = true;
        this.retryQueue.push({ sugoId, amount });
        this.startRetryMechanism();
      }

      if (responseData?.rspHead?.code === 2) {
        console.warn(
          'Inner server error (Code 2). Locking system and starting retry mechanism.',
        );
        this.isSystemLocked = true;
        this.retryQueue.push({ sugoId, amount });
        this.startRetryMechanism();
      }

      if (responseData?.rspHead?.code === 0) {
        this.isSystemLocked = false;

        // sent client notification
        const coinPurchasePayload: any = {
          sender_id: null,
          receiver_id: userId,
          text: `Your coin ${amount} is successfully transferred to your Sugo account ${sugoId}`,
          type: 'client_coin_purchase',
        };

        this.notificationRepository.createNotification(coinPurchasePayload);

        const userSocketId = this.messageGateway.clients.get(userId);

        if (userSocketId) {
          this.messageGateway.server
            .to(userSocketId)
            .emit('cointTransferDone', coinPurchasePayload);
        }

        // send email
        if (user && user.email) {
          await this.mailService.sendCoinTransferSuccessEmail({
            email: user.email,
            name: user.name || '',
            amount,
            sugoId,
          });
        }

        return {
          success: true,
          message: 'Coins transferred to Sugo successfully',
        };
      }

      if (
        responseData?.rspHead?.code === 20308 ||
        responseData?.rspHead?.code === 20601 ||
        responseData?.rspHead?.code === 80003
      ) {
        console.warn(
          'Invalid request (Code 20308 || 20601 || 80003). Locking system and starting retry mechanism.',
        );
        this.isSystemLocked = false;
        await this.notifyUser(userId, 'Invalid request', 'coinTransferFailed');
        return {
          success: true,
          message: 'Invalid request',
        };
      }

      if (responseData?.rspHead?.code === 80004) {
        console.warn(
          'User is banned (Code 80004). Locking system and starting retry mechanism.',
        );
        this.isSystemLocked = false;
        await this.notifyUser(userId, 'User is banned', 'coinTransferFailed');
        return {
          success: true,
          message: 'User is banned',
        };
      }

      if (responseData?.rspHead?.code === 80002) {
        console.warn(
          'Not Valid Recharge coin amount (Code 80002). Locking system and starting retry mechanism.',
        );
        this.isSystemLocked = false;
        await this.notifyUser(
          userId,
          'Not Valid Recharge coin amount',
          'coinTransferFailed',
        );
        return {
          success: true,
          message: 'Not Valid Recharge coin amount',
        };
      }

      if (responseData?.rspHead?.code === 80001) {
        console.warn(
          'Cross religion transfer not allowed (Code 80001). Locking system and starting retry mechanism.',
        );
        this.isSystemLocked = false;
        await this.notifyUser(
          userId,
          'Cross religion transfer not allowed',
          'coinTransferFailed',
        );
        return {
          success: true,
          message: 'Cross religion transfer not allowed',
        };
      }

      if (responseData?.rspHead?.code === 3) {
        console.warn(
          'Invalid parameters (Code 3). Locking system and starting retry mechanism.',
        );
        this.isSystemLocked = false;
        await this.notifyUser(
          userId,
          'Invalid parameters',
          'coinTransferFailed',
        );
        return {
          success: true,
          message: 'Invalid parameters',
        };
      }

      if (responseData?.rspHead?.code === 5) {
        console.warn(
          'Invalid parameters (Code 5). Locking system and starting retry mechanism.',
        );
        this.isSystemLocked = false;
        await this.notifyUser(
          userId,
          'Invalid parameters',
          'coinTransferFailed',
        );
        return {
          success: true,
          message: 'Invalid parameters',
        };
      }

      if (responseData?.rspHead?.code === 45) {
        console.warn(
          'Invalid request (Code 45). Locking system and starting retry mechanism.',
        );
        this.isSystemLocked = false;
        await this.notifyUser(
          userId,
          'This is not allowed for safety',
          'coinTransferFailed',
        );
        return {
          success: true,
          message: 'This is not allowed for safety',
        };
      }

      return {
        success: false,
        message: 'Failed to transfer coins to Sugo',
      };
    } catch (error) {
      console.error(
        'Failed to transfer coins to Sugo:',
        error.response?.data || error.message,
      );
    }
  }

  private async notifyUser(userId: string, message: string, eventName: string) {
    const payload: any = {
      sender_id: null,
      receiver_id: userId,
      text: message,
      type: 'client_coin_purchase',
    };

    await this.notificationRepository.createNotification(payload);
    const userSocketId = this.messageGateway.clients.get(userId);

    if (userSocketId) {
      this.messageGateway.server.to(userSocketId).emit(eventName, payload);
    }
  }

  private startRetryMechanism() {
    if (this.retryInterval) {
      return; // Already running
    }

    console.log('Starting Sugo transfer retry mechanism...');
    this.retryInterval = setInterval(async () => {
      if (this.retryQueue.length === 0) {
        console.log('Retry queue empty. Unlocking system.');
        this.isSystemLocked = false;
        if (this.retryInterval) {
          clearInterval(this.retryInterval);
          this.retryInterval = null;
        }
        return;
      }

      const item = this.retryQueue[0];
      console.log(
        `Retrying transfer for Sugo ID: ${item.sugoId}, Amount: ${item.amount}`,
      );

      try {
        const url = appConfig().sugo.coinTransferUrl;
        const sellerId = appConfig().sugo.ownerId;

        const payload = {
          coin_seller_id: sellerId,
          user_id: item.sugoId,
          recharge_amount: item.amount.toString(),
          nonce: Date.now().toString(),
        };

        const result = await axios.post(url, payload);
        const responseData = result.data;

        if (responseData?.rspHead?.code === 0) {
          console.log('Retry successful. Removing item from queue.');
          this.retryQueue.shift(); // Remove the successful item
        } else if (responseData?.rspHead?.code === 80002) {
          console.log('Retry failed with code 80002. Will retry again later.');
        } else {
          console.log(
            `Retry returned unexpected code: ${responseData?.rspHead?.code}. Will retry again later.`,
          );
        }
      } catch (error) {
        console.error('Retry attempt failed:', error.message);
      }
    }, this.RETRY_INTERVAL_MS);
  }
}
