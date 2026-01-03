import { Injectable } from '@nestjs/common';
import { FindAllOrderQueryDto } from './dto/query-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: FindAllOrderQueryDto) {
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
          o.user.name as user_name, 
          'COIN' as type,
          cb.name as title,
          cb.thumbnail as thumbnail
        FROM coin_orders o
        LEFT JOIN coin_bundles cb ON o.coin_bundle_id = cb.id
      )
      UNION ALL
      (
        SELECT 
          o.id, 
          o.amount, 
          o.status, 
          1 as quantity,
          o.created_at, 
          o.user.name as user_name, 
          'TICKET' as type,
          et.title as title,
          et.thumbnail as thumbnail
        FROM event_orders o
        LEFT JOIN event_tickets et ON o.event_ticket_id = et.id
      )
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const totalCount: any[] = await this.prisma.$queryRaw`
      SELECT (
        (SELECT COUNT(*) FROM coin_orders) +
        (SELECT COUNT(*) FROM event_orders)
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

  findOne(id: number) {
    return `This action returns a #${id} order`;
  }
}
