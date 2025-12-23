import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { FindAllQueryDto } from './dto/query-ticket.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import { TransactionRepository } from 'src/common/repository/transaction/transaction.repository';

@Injectable()
export class TicketService {
  constructor(private prisma: PrismaService, private readonly transactionRepository: TransactionRepository) { }

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

  async createTicketOrder(userId: string, ticketId: string) {
    try {
      const ticket = await this.prisma.eventTicket.findUnique({
        where: {
          id: ticketId,
          status: 'Active',
        },
      });

      if (!ticket) {
        return {
          success: false,
          message: 'Ticket not found or inactive',
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
        amount: ticket.ticket_price,
        currency: 'usd',
        customer_id: stripeCustomerId,
        metadata: {
          type: 'ticket_order',
          user_id: userId,
          ticket_id: ticketId,
        },
      });

      // Create transaction
      const transaction = await this.transactionRepository.createTransaction({
        order_id: null,
        amount: ticket.ticket_price,
        currency: 'usd',
        reference_number: paymentIntent.id,
        status: 'pending',
        type: 'ticket_order',
      });

      // Create ticket order
      const ticketOrder = await this.prisma.eventOrder.create({
        data: {
          user_id: userId,
          event_ticket_id: ticketId,
          amount: ticket.ticket_price,
          status: 'pending',
          transaction_id: transaction.id,
        },
      });

      return {
        success: true,
        data: {
          client_secret: paymentIntent.client_secret,
          order_id: ticketOrder.id,
        },
      };

    } catch (error) {
      console.log(error);
      return {
        success: false,
        message: 'Failed to create ticket order',
      };
    }
  }

  // update(id: string, updateTicketDto: UpdateTicketDto) {
  //   return `This action updates a #${id} ticket`;
  // }

  // remove(id: string) {
  //   return `This action removes a #${id} ticket`;
  // }
}
