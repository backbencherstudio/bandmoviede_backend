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

@Injectable()
export class TicketService {
  constructor(private prisma: PrismaService) {}

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

  // update(id: string, updateTicketDto: UpdateTicketDto) {
  //   return `This action updates a #${id} ticket`;
  // }

  // remove(id: string) {
  //   return `This action removes a #${id} ticket`;
  // }
}
