import { Injectable } from '@nestjs/common';
import { FindAllOrderQueryDto } from './dto/query-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'prisma/generated/client';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindAllOrderQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;
    const search = query.search || '';
    const type = query.type;
    const filter = query.filter || 'all';

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

    // Build the WHERE clause for date filtering
    const dateFilter =
      startDate && endDate
        ? Prisma.sql`AND o.created_at >= ${startDate}::timestamp AND o.created_at <= ${endDate}::timestamp`
        : Prisma.empty;

    // Build search pattern
    const searchPattern = `%${search}%`;

    const coinSearchFilter = search
      ? Prisma.sql`AND (LOWER(u.name) LIKE LOWER(${searchPattern}) OR LOWER(cb.name) LIKE LOWER(${searchPattern}))`
      : Prisma.empty;

    const ticketSearchFilter = search
      ? Prisma.sql`AND (LOWER(u.name) LIKE LOWER(${searchPattern}) OR LOWER(et.title) LIKE LOWER(${searchPattern}))`
      : Prisma.empty;

    let orders: any[] = [];

    // Fetch orders based on type filter
    if (!type) {
      // Combine both coin and ticket orders using UNION ALL
      orders = await this.prisma.$queryRaw<any[]>`
        (
          SELECT 
            o.id,
            o.user_id,
            o.coin_bundle_id,
            NULL AS event_ticket_id,
            o.transaction_id,
            o.amount AS price,
            o.status,
            o.quantity AS amount,
            o.created_at AS payment_date,
            u.name AS user_name,
            'COIN' AS type,
            cb.name AS coin_name,
            NULL AS ticket_title,
            cb.thumbnail AS thumbnail,
            NULL AS ticket_number,
            pt.reference_number AS payment_number,
            NULL AS used -- Added placeholder
          FROM coin_orders o
          LEFT JOIN users u ON o.user_id = u.id
          LEFT JOIN coin_bundles cb ON o.coin_bundle_id = cb.id
          LEFT JOIN payment_transactions pt ON o.transaction_id = pt.id
          WHERE 1=1 ${dateFilter} ${coinSearchFilter}
        )
        UNION ALL
        (
          SELECT 
            o.id,
            o.user_id,
            NULL AS coin_bundle_id,
            o.event_ticket_id,
            o.transaction_id,
            o.amount AS price,
            o.status,
            1 AS amount,
            o.created_at AS payment_date,
            u.name AS user_name,
            'TICKET' AS type,
            NULL AS coin_name,
            et.title AS ticket_title,
            et.thumbnail AS thumbnail,
            o.ticket_code AS ticket_number,
            pt.reference_number AS payment_number,
            o.used AS used -- Added used field
          FROM event_orders o
          LEFT JOIN users u ON o.user_id = u.id
          LEFT JOIN event_tickets et ON o.event_ticket_id = et.id
          LEFT JOIN payment_transactions pt ON o.transaction_id = pt.id
          WHERE 1=1 ${dateFilter} ${ticketSearchFilter}
        )
        ORDER BY payment_date DESC
        LIMIT ${limit} OFFSET ${skip}
      `;
    } else if (type === 'COIN') {
      orders = await this.prisma.$queryRaw<any[]>`
        SELECT 
          o.id,
          o.user_id,
          o.coin_bundle_id,
          o.transaction_id,
          o.amount AS price,
          o.status,
          o.quantity AS amount,
          o.created_at AS payment_date,
          u.name AS user_name,
          'COIN' AS type,
          cb.name AS coin_name,
          cb.thumbnail AS thumbnail,
          pt.reference_number AS payment_number,
          NULL AS used -- Added placeholder
        FROM coin_orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN coin_bundles cb ON o.coin_bundle_id = cb.id
        LEFT JOIN payment_transactions pt ON o.transaction_id = pt.id
        WHERE 1=1 ${dateFilter} ${coinSearchFilter}
        ORDER BY o.created_at DESC
        LIMIT ${limit} OFFSET ${skip}
      `;
    } else if (type === 'TICKET') {
      orders = await this.prisma.$queryRaw<any[]>`
        SELECT 
          o.id,
          o.user_id,
          o.event_ticket_id,
          o.transaction_id,
          o.amount AS ticket_price,
          o.status,
          1 AS quantity,
          o.created_at AS payment_date,
          u.name AS user_name,
          'TICKET' AS type,
          et.title AS ticket_title,
          et.thumbnail AS thumbnail,
          o.ticket_code AS ticket_number,
          pt.reference_number AS payment_number,
          o.used AS used -- Added used field
        FROM event_orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN event_tickets et ON o.event_ticket_id = et.id
        LEFT JOIN payment_transactions pt ON o.transaction_id = pt.id
        WHERE 1=1 ${dateFilter} ${ticketSearchFilter}
        ORDER BY o.created_at DESC
        LIMIT ${limit} OFFSET ${skip}
      `;
    }

    // Get total count
    let totalCount = 0;

    if (!type) {
      const [coinCount] = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM coin_orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN coin_bundles cb ON o.coin_bundle_id = cb.id
        WHERE 1=1 ${dateFilter} ${coinSearchFilter}
      `;

      const [ticketCount] = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM event_orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN event_tickets et ON o.event_ticket_id = et.id
        WHERE 1=1 ${dateFilter} ${ticketSearchFilter}
      `;

      totalCount = Number(coinCount.count) + Number(ticketCount.count);
    } else if (type === 'COIN') {
      const [coinCount] = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM coin_orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN coin_bundles cb ON o.coin_bundle_id = cb.id
        WHERE 1=1 ${dateFilter} ${coinSearchFilter}
      `;
      totalCount = Number(coinCount.count);
    } else {
      const [ticketCount] = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM event_orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN event_tickets et ON o.event_ticket_id = et.id
        WHERE 1=1 ${dateFilter} ${ticketSearchFilter}
      `;
      totalCount = Number(ticketCount.count);
    }

    return {
      success: true,
      message:
        orders.length > 0 ? 'Orders retrieved successfully' : 'No orders found',
      data: orders,
      meta_data: {
        total: totalCount,
        page: page,
        limit: limit,
        search: search,
        type: type || 'all',
        filter: filter,
      },
    };
  }

  async updateTicketUsage(id: string, used: boolean) {
    try {
      const order = await this.prisma.eventOrder.update({
        where: { id },
        data: { used },
      });

      return {
        success: true,
        message: 'Ticket usage status updated successfully',
        data: order,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update ticket usage status',
      };
    }
  }
}
