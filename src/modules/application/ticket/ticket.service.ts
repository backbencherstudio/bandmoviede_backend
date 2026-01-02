import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { FindAllQueryDto } from './dto/query-ticket.dto';
import { CheckoutTicketDto } from './dto/checkout-ticket.dto';
import {
  CreateTicketCheckoutDto,
  UpdateTicketCheckoutDto,
} from './dto/ticket-checkout.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import { TransactionRepository } from 'src/common/repository/transaction/transaction.repository';

@Injectable()
export class TicketService {
  constructor(
    private prisma: PrismaService,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  // create(createTicketDto: CreateTicketDto) {
  //   return 'This action adds a new ticket';
  // }

  async findAll(query: FindAllQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.eventTicket.findMany({
        where: {
          status: 'Active',
        },
        select: {
          id: true,
          title: true,
          description: true,
          ticket_price: true,
          thumbnail: true,
          sold_limit: true,
          total_sold: true,
          event_date: true,
          location: true,
          status: true,
          created_at: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.eventTicket.count({
        where: {
          status: 'Active',
        },
      }),
    ]);
    return {
      success: data.length > 0 ? true : false,
      message:
        data.length > 0 ? 'Tickets fetched successfully' : 'No tickets found',
      data: data.map((ticket) => ({
        ...ticket,
        thumbnail: ticket?.thumbnail
          ? SojebStorage.url(
              appConfig().storageUrl.ticketThumbnails + ticket.thumbnail,
            )
          : null,
      })),
      meta_data: {
        total,
        page,
        limit,
      },
    };
  }

  async findOne(id: string) {
    if (!id) {
      throw new BadRequestException('Ticket id is required');
    }
    const ticket = await this.prisma.eventTicket.findUnique({
      where: {
        id,
        status: 'Active',
      },
      select: {
        id: true,
        title: true,
        description: true,
        about: true,
        included: true,
        ticket_price: true,
        thumbnail: true,
        sold_limit: true,
        total_sold: true,
        event_date: true,
        location: true,
        status: true,
        created_at: true,
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return {
      success: true,
      message: 'Ticket fetched successfully',
      data: ticket
        ? {
            ...ticket,
            thumbnail: ticket?.thumbnail
              ? SojebStorage.url(
                  appConfig().storageUrl.ticketThumbnails + ticket.thumbnail,
                )
              : null,
          }
        : null,
    };
  }

  async checkout(userId: string, body: CheckoutTicketDto) {
    try {
      if (!body.items || body.items.length === 0) {
        throw new BadRequestException('No tickets provided');
      }

      // 1. Validate all tickets and calculate total amount
      let totalAmount = 0;
      const ticketDetails = [];

      for (const item of body.items) {
        const ticket = await this.prisma.eventTicket.findUnique({
          where: { id: item.ticket_id, status: 'Active' },
        });

        if (!ticket) {
          throw new BadRequestException(
            `Ticket not found or inactive: ${item.ticket_id}`,
          );
        }

        if (
          ticket.sold_limit &&
          ticket.total_sold + item.quantity > ticket.sold_limit
        ) {
          throw new BadRequestException(
            `Not enough stock for ticket: ${ticket.title}`,
          );
        }

        totalAmount += ticket.ticket_price * item.quantity;
        ticketDetails.push({ ticket, quantity: item.quantity });
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
          type: 'ticket_checkout',
          user_id: userId,
          ticket_count: body.items.length.toString(),
        },
      });

      // 4. Create Transaction and Orders in a Prisma Transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create Transaction Record
        const transaction = await this.transactionRepository.createTransaction(
          {
            order_id: null, // Will key this manually or leave null as it's multiple orders
            amount: totalAmount,
            currency: 'usd',
            reference_number: paymentIntent.id,
            status: 'pending',
            type: 'ticket_checkout',
          },
          prisma,
        ); // Pass prisma transaction client if repository supports it, otherwise generic create

        const createdOrders = [];

        for (const item of ticketDetails) {
          // Update ticket sold count
          await prisma.eventTicket.update({
            where: { id: item.ticket.id },
            data: { total_sold: { increment: item.quantity } },
          });

          // Create individual orders for each quantity to allow unique ticket codes later
          for (let i = 0; i < item.quantity; i++) {
            const order = await prisma.eventOrder.create({
              data: {
                user_id: userId,
                event_ticket_id: item.ticket.id,
                amount: item.ticket.ticket_price,
                status: 'pending',
                transaction_id: transaction.id,
              },
            });
            createdOrders.push(order);
          }
        }

        return { transaction, createdOrders };
      });

      return {
        success: true,
        message: 'Ticket checkout successful',
        // data: {
        //   client_secret: paymentIntent.client_secret,
        //   transaction_id: result.transaction.id,
        //   orders: result.createdOrders.map((o) => o.id),
        // },
      };
    } catch (error) {
      console.error(error);
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

  async createTicketOrder(userId: string, ticketId: string) {
    try {
      const result = await this.checkout(userId, {
        items: [{ ticket_id: ticketId, quantity: 1 }],
      });

      if (!result.success) {
        return result;
      }

      // Adapt response to match old format
      return {
        success: true,
        message: 'Ticket order created successfully',
        // data: {
        //   client_secret: result.data.client_secret,
        //   order_id: result.data.orders[0],
        // },
      };
    } catch (error) {
      console.error(error);
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

  // --- Draft CRUD ---

  async createCheckoutDraft(userId: string, body: CreateTicketCheckoutDto) {
    try {
      // Validate tickets exist
      for (const item of body.items) {
        const ticket = await this.prisma.eventTicket.findUnique({
          where: { id: item.ticket_id },
        });
        if (!ticket)
          throw new BadRequestException(`Invalid ticket id: ${item.ticket_id}`);
      }

      const draft = await this.prisma.ticketCheckout.create({
        data: {
          user_id: userId,
          items: {
            create: body.items.map((item) => ({
              event_ticket_id: item.ticket_id,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              event_ticket: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Checkout draft created',
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        message: 'Failed to create checkout draft',
      };
    }
  }

  async getCheckoutDrafts(userId: string) {
    try {
      const drafts = await this.prisma.ticketCheckout.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          user_id: true,
          created_at: true,
          items: {
            select: {
              id: true,
              quantity: true,
              created_at: true,
              event_ticket: {
                select: {
                  id: true,
                  title: true,
                  ticket_status: true,
                  event_date: true,
                  location: true,
                  ticket_price: true,
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
          event_ticket: {
            ...item.event_ticket,
            thumbnail_url: item.event_ticket.thumbnail
              ? SojebStorage.url(
                  appConfig().storageUrl.ticketThumbnails +
                    item.event_ticket.thumbnail,
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
      const draft = await this.prisma.ticketCheckout.findUnique({
        where: { id },
        select: {
          id: true,
          user_id: true,
          created_at: true,
          items: {
            select: {
              id: true,
              quantity: true,
              created_at: true,
              event_ticket: {
                select: {
                  id: true,
                  title: true,
                  ticket_status: true,
                  event_date: true,
                  location: true,
                  ticket_price: true,
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
          event_ticket: {
            ...item.event_ticket,
            thumbnail_url: item.event_ticket.thumbnail
              ? SojebStorage.url(
                  appConfig().storageUrl.ticketThumbnails +
                    item.event_ticket.thumbnail,
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
    body: UpdateTicketCheckoutDto,
  ) {
    try {
      const draft = await this.prisma.ticketCheckout.findUnique({
        where: { id },
      });

      if (!draft || draft.user_id !== userId) {
        throw new NotFoundException('Draft not found');
      }

      const updateData: any = {};

      if (body.items) {
        // Replace items logic
        updateData.items = {
          deleteMany: {},
          create: body.items.map((item) => ({
            event_ticket_id: item.ticket_id,
            quantity: item.quantity,
          })),
        };
      }

      const updatedDraft = await this.prisma.ticketCheckout.update({
        where: { id },
        data: updateData,
        include: {
          items: {
            include: {
              event_ticket: true,
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
      const draft = await this.prisma.ticketCheckout.findUnique({
        where: { id },
      });

      if (draft) {
        if (draft.user_id !== userId) {
          throw new NotFoundException('Draft not found');
        }

        await this.prisma.ticketCheckout.delete({
          where: { id },
        });

        return {
          success: true,
          message: 'Draft deleted successfully',
        };
      }

      // 2. If not a draft, try to find and delete as an Item
      const item = await this.prisma.ticketCheckoutItem.findUnique({
        where: { id },
        include: { ticket_checkout: true },
      });

      if (item) {
        if (item.ticket_checkout.user_id !== userId) {
          throw new NotFoundException('Item not found');
        }

        await this.prisma.ticketCheckoutItem.delete({
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
}
