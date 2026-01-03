import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  FindAllOrderQueryDto,
  FindEventTicketsQueryDto,
} from './dto/query-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindAllOrderQueryDto, user_id: string) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const orders: any[] = await this.prisma.$queryRaw`
      (
        SELECT 
          o.id, 
          o.amount, 
          o.status, 
          o.quantity,
          o.created_at, 
          'COIN' as type,
          cb.name as title,
          cb.thumbnail as thumbnail
        FROM coin_orders o
        LEFT JOIN coin_bundles cb ON o.coin_bundle_id = cb.id
        WHERE o.user_id = ${user_id}
      )
      UNION ALL
      (
        SELECT 
          o.id, 
          o.amount, 
          o.status, 
          1 as quantity,
          o.created_at, 
          'TICKET' as type,
          et.title as title,
          et.thumbnail as thumbnail
        FROM event_orders o
        LEFT JOIN event_tickets et ON o.event_ticket_id = et.id
        WHERE o.user_id = ${user_id}
      )
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const totalCount: any[] = await this.prisma.$queryRaw`
      SELECT (
        (SELECT COUNT(*) FROM coin_orders WHERE user_id = ${user_id}) +
        (SELECT COUNT(*) FROM event_orders WHERE user_id = ${user_id})
      ) as total
    `;

    const total = Number(totalCount[0]?.total || 0);

    return {
      success: true,
      message:
        orders.length > 0 ? 'Orders retrieved successfully' : 'No orders found',
      data: orders,
      meta_data: {
        total: total,
        page: page,
        limit: limit,
      },
    };
  }

  async getStats(user_id: string) {
    if (!user_id) throw new UnauthorizedException('User id is required');
    const [totalTicketOrders, totalCoinOrders, totalActiveTickets] =
      await Promise.all([
        this.prisma.eventOrder.count({ where: { user_id } }),
        this.prisma.coinOrder.count({ where: { user_id } }),
        this.prisma.eventOrder.count({
          where: { user_id, event_ticket: { status: 'Active' } },
        }),
      ]);

    return {
      success: true,
      message: 'Stats retrieved successfully',
      data: {
        total_order: totalTicketOrders + totalCoinOrders || 0,
        total_active_tickets: totalActiveTickets || 0,
      },
    };
  }

  async findEventTickets(user_id: string, query: FindEventTicketsQueryDto) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const activeTickets = this.prisma.eventOrder.findMany({
      where: {
        user_id,
        ...(query.status ? { event_ticket: { status: query.status } } : {}),
      },
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    });
    return {
      success: true,
      message: 'Active tickets retrieved successfully',
      data: activeTickets,
    };
  }
}
