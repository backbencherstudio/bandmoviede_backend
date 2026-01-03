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
        u.name AS user_name,
        'COIN' AS type,
        cb.name AS title,
        cb.thumbnail AS thumbnail
      FROM coin_orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN coin_bundles cb ON o.coin_bundle_id = cb.id
    )
    UNION ALL
    (
      SELECT 
        o.id,
        o.amount,
        o.status,
        1 AS quantity,
        o.created_at,
        u.name AS user_name,
        'TICKET' AS type,
        et.title AS title,
        et.thumbnail AS thumbnail
      FROM event_orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN event_tickets et ON o.event_ticket_id = et.id
    )
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${skip};
  `;

    const [{ total }] = await this.prisma.$queryRaw<{ total: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM coin_orders) +
      (SELECT COUNT(*) FROM event_orders) AS total;
    `;

    const totalCount = Number(total[0]?.total || 0);

    return {
      success: true,
      message:
        orders.length > 0 ? 'Orders retrieved successfully' : 'No orders found',
      data: orders,
      meta_data: {
        total: totalCount,
        page: page,
        limit: limit,
      },
    };
  }
}
