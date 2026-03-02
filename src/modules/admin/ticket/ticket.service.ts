import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { FindAllQueryDto } from './dto/query-ticket.dto';
import { Prisma } from 'prisma/generated/client';

@Injectable()
export class TicketService {
  constructor(private prisma: PrismaService) {}
  async create(
    createTicketDto: CreateTicketDto,
    userId: string,
    thumbnail: Express.Multer.File,
  ) {
    const {
      title,
      description,
      about,
      ticket_status,
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
        ticket_status,
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
    };
  }

  async findAll(query: FindAllQueryDto) {
    const { search, page = 1, limit = 10, filter = 'all' } = query;
    const skip = (page - 1) * limit;
    const take = limit;
    const where: Prisma.EventTicketWhereInput = { deleted_at: null };

    // Build date filter conditions
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (filter) {
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case 'last_year':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        break;
    }

    // Add date filter to where clause
    if (startDate && endDate) {
      where.created_at = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Add search filter
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
          ticket_status: true,
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
        filter,
      },
    };
  }

  async findOne(id: string) {
    if (!id) {
      throw new BadRequestException('Ticket id is required');
    }
    const ticket = await this.prisma.eventTicket.findUnique({
      where: { id, deleted_at: null },
      select: {
        id: true,
        title: true,
        description: true,
        about: true,
        included: true,
        ticket_price: true,
        status: true,
        ticket_status: true,
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
      where: { id, deleted_at: null },
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
    };
  }

  async updateUsed(id: string) {
    if (!id) {
      throw new BadRequestException('Ticket id is required');
    }
    const ticket = await this.prisma.eventOrder.findUnique({
      where: { id },
    });
    if (!ticket) {
      throw new InternalServerErrorException('Ticket not found');
    }

    await this.prisma.eventOrder.update({
      where: { id },
      data: { used: !ticket.used },
    });
    return {
      success: true,
      message: 'Ticket used status updated successfully',
    };
  }

  async remove(id: string) {
    if (!id) {
      throw new BadRequestException('Ticket id is required');
    }
    const ticket = await this.prisma.eventTicket.findUnique({
      where: { id, deleted_at: null },
    });
    if (!ticket) {
      throw new InternalServerErrorException('Ticket not found');
    }
    await this.prisma.eventTicket.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    if (ticket.thumbnail) {
      await SojebStorage.delete(
        appConfig().storageUrl.ticketThumbnails + ticket.thumbnail,
      );
    }
    return {
      success: true,
      message: 'Ticket deleted successfully',
    };
  }

  async getStats() {
    const [
      totalTickets,
      activeTickets,
      inactiveTickets,
      totalSold,
      totalRevenue,
      totalUpcoming,
    ] = await Promise.all([
      this.prisma.eventTicket.aggregate({
        _sum: {
          sold_limit: true,
        },
        where: { deleted_at: null },
      }),
      this.prisma.eventTicket.count({
        where: { status: 'Active', deleted_at: null },
      }),
      this.prisma.eventTicket.count({
        where: { status: 'Inactive', deleted_at: null },
      }),
      this.prisma.eventTicket.aggregate({
        _sum: { total_sold: true },
        where: { deleted_at: null },
      }),
      this.prisma.eventTicket.aggregate({
        _sum: { revenue: true },
        where: { deleted_at: null },
      }),
      this.prisma.eventTicket.count({
        where: { event_date: { gte: new Date() }, deleted_at: null },
      }),
    ]);
    return {
      success: true,
      message: 'Ticket stats fetched successfully',
      data: {
        total_tickets: totalTickets._sum.sold_limit || 0,
        active_tickets: activeTickets || 0,
        inactive_tickets: inactiveTickets || 0,
        total_sold: totalSold._sum.total_sold || 0,
        total_revenue: totalRevenue._sum.revenue || 0,
        total_upcoming: totalUpcoming || 0,
      },
    };
  }
}
