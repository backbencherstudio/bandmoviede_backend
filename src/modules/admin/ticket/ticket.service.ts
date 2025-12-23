import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Express } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { FindAllQueryDto } from './dto/query-ticket.dto';
import { Prisma } from 'prisma/generated/client';
import { TransactionRepository } from 'src/common/repository/transaction/transaction.repository';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';

@Injectable()
export class TicketService {
  constructor(
    private prisma: PrismaService,
    private readonly transactionRepository: TransactionRepository,
  ) { }
  async create(
    createTicketDto: CreateTicketDto,
    userId: string,
    thumbnail: Express.Multer.File,
  ) {
    const {
      title,
      description,
      about,
      included,
      ticket_price,
      is_active = true,
      sold_limit,
      event_date,
      location,
    } = createTicketDto;

    let fileName: string | null = null;

    if (thumbnail) {
      try {
        fileName = `${StringHelper.randomString()}${thumbnail.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.ticketThumbnails + fileName,
          thumbnail.buffer,
        );
      } catch (error) {
        throw new InternalServerErrorException('Failed to upload thumbnail');
      }
    }

    const ticket = await this.prisma.eventTicket.create({
      data: {
        title,
        description,
        about,
        included,
        ticket_price,
        status: is_active ? 'Active' : 'Inactive',
        sold_limit,
        event_date,
        location,
        user_id: userId,
        ...(thumbnail && fileName ? { thumbnail: fileName } : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        about: true,
        included: true,
        ticket_price: true,
        status: true,
        sold_limit: true,
        event_date: true,
        location: true,
        thumbnail: true,
      },
    });
    if (!ticket) {
      throw new InternalServerErrorException('Failed to create ticket');
    }
    return {
      success: true,
      message: 'Ticket created successfully',
      data: {
        ...ticket,
        thumbnail: ticket?.thumbnail
          ? SojebStorage.url(
            appConfig().storageUrl.ticketThumbnails + ticket.thumbnail,
          )
          : null,
      },
    };
  }

  async findAll(query: FindAllQueryDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const take = limit;
    const where: Prisma.EventTicketWhereInput = {};
    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];

      if (search.toLowerCase() === 'active') {
        where.OR.push({ status: 'Active' });
      } else if (search.toLowerCase() === 'inactive') {
        where.OR.push({ status: 'Inactive' });
      }
    }

    const [data, count] = await Promise.all([
      this.prisma.eventTicket.findMany({
        select: {
          id: true,
          title: true,
          ticket_price: true,
          status: true,
          sold_limit: true,
          event_date: true,
          revenue: true,
          total_sold: true,
          created_at: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        where,
        skip,
        take,
      }),
      this.prisma.eventTicket.count({ where }),
    ]);
    return {
      success: data.length > 0 ? true : false,
      message:
        data.length > 0 ? 'Tickets fetched successfully' : 'No tickets found',
      data,
      meta_data: {
        page,
        limit,
        total: count,
      },
    };
  }

  async findOne(id: string) {
    if (!id) {
      throw new BadRequestException('Ticket id is required');
    }
    const ticket = await this.prisma.eventTicket.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        about: true,
        included: true,
        ticket_price: true,
        status: true,
        sold_limit: true,
        event_date: true,
        location: true,
        thumbnail: true,
        revenue: true,
        total_sold: true,
        created_at: true,
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return {
      success: true,
      message: 'Ticket fetched successfully',
      data: {
        ...ticket,
        thumbnail: ticket?.thumbnail
          ? SojebStorage.url(
            appConfig().storageUrl.ticketThumbnails + ticket.thumbnail,
          )
          : null,
      },
    };
  }

  async update(
    id: string,
    updateTicketDto: UpdateTicketDto,
    thumbnail?: Express.Multer.File,
  ) {
    if (!id) {
      throw new BadRequestException('Ticket id is required');
    }
    const { is_active = true, ...rest } = updateTicketDto;
    let fileName: string | null = null;

    if (thumbnail) {
      try {
        fileName = `${StringHelper.randomString()}${thumbnail.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.ticketThumbnails + fileName,
          thumbnail.buffer,
        );
      } catch (error) {
        throw new InternalServerErrorException('Failed to upload thumbnail');
      }
    }

    const ticket = await this.prisma.eventTicket.update({
      where: { id },
      data: {
        ...rest,
        status: is_active ? 'Active' : 'Inactive',
        ...(thumbnail && fileName ? { thumbnail: fileName } : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        about: true,
        included: true,
        ticket_price: true,
        status: true,
        sold_limit: true,
        event_date: true,
        location: true,
        thumbnail: true,
        revenue: true,
        total_sold: true,
        created_at: true,
      },
    });
    if (!ticket) {
      throw new InternalServerErrorException('Failed to update ticket');
    }
    return {
      success: true,
      message: 'Ticket updated successfully',
      data: {
        ...ticket,
        thumbnail: ticket?.thumbnail
          ? SojebStorage.url(
            appConfig().storageUrl.ticketThumbnails + ticket.thumbnail,
          )
          : null,
      },
    };
  }

  async remove(id: string) {
    if (!id) {
      throw new BadRequestException('Ticket id is required');
    }
    const ticket = await this.prisma.eventTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new InternalServerErrorException('Ticket not found');
    }
    await this.prisma.eventTicket.delete({ where: { id } });
    return {
      success: true,
      message: 'Ticket deleted successfully',
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
}
