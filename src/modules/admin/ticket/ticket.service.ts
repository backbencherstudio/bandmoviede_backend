import { Injectable } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Express } from 'express';
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
      included,
      ticket_price,
      is_active = true,
      sold_limit,
      event_date,
      location,
    } = createTicketDto;

    let fileName: string | null = null;

    if (thumbnail) {
      fileName = `${StringHelper.randomString()}${thumbnail.originalname}`;
      await SojebStorage.put(
        appConfig().storageUrl.ticketThumbnails + fileName,
        thumbnail.buffer,
      );
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
    return {
      success: true,
      message: 'Ticket created successfully',
      data: {
        ...ticket,
        thumbnail: ticket?.thumbnail
          ? appConfig().storageUrl.ticketThumbnails + ticket.thumbnail
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
      success: true,
      message: 'Tickets fetched successfully',
      data,
      meta_data: {
        page,
        limit,
        total: count,
      },
    };
  }

  async findOne(id: string) {
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
    return {
      success: true,
      message: 'Ticket fetched successfully',
      data: {
        ...ticket,
        thumbnail: ticket?.thumbnail
          ? appConfig().storageUrl.ticketThumbnails + ticket.thumbnail
          : null,
      },
    };
  }

  async update(
    id: string,
    updateTicketDto: UpdateTicketDto,
    thumbnail?: Express.Multer.File,
  ) {
    const { is_active = true, ...rest } = updateTicketDto;
    let fileName: string | null = null;

    if (thumbnail) {
      fileName = `${StringHelper.randomString()}${thumbnail.originalname}`;
      await SojebStorage.put(
        appConfig().storageUrl.ticketThumbnails + fileName,
        thumbnail.buffer,
      );
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
    return {
      success: true,
      message: 'Ticket updated successfully',
      data: {
        ...ticket,
        thumbnail: ticket?.thumbnail
          ? appConfig().storageUrl.ticketThumbnails + ticket.thumbnail
          : null,
      },
    };
  }

  async remove(id: string) {
    await this.prisma.eventTicket.delete({ where: { id } });
    return {
      success: true,
      message: 'Ticket deleted successfully',
    };
  }
}
