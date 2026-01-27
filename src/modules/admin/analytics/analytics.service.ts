import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as dayjs from 'dayjs';
import { PaginationQueryDto } from './dto/query-analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyRevenueComparison() {
    const now = dayjs();
    const currentYear = now.year();
    const lastYear = currentYear - 1;

    const startDate = dayjs().year(lastYear).startOf('year').toDate();
    const endDate = dayjs().year(currentYear).endOf('year').toDate();

    const rows = await this.prisma.$queryRaw<
      { month: number; year: number; revenue: number }[]
    >`
    SELECT 
      EXTRACT(MONTH FROM created_at)::int AS month,
      EXTRACT(YEAR FROM created_at)::int AS year,
      SUM(amount) AS revenue
    FROM (
      SELECT created_at, amount FROM coin_orders
      WHERE status = 'completed'

      UNION ALL

      SELECT created_at, amount FROM event_orders
      WHERE status = 'completed'
    ) t
    WHERE created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY year, month
    ORDER BY year, month;
  `;

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // Initialize fixed 12 months (O(12))
    const result = months.map((month) => ({
      month,
      currentYear: 0,
      lastYear: 0,
    }));

    rows.forEach(({ month, year, revenue }) => {
      const index = month - 1;
      if (year === currentYear) {
        result[index].currentYear += Number(revenue);
      } else if (year === lastYear) {
        result[index].lastYear += Number(revenue);
      }
    });

    return {
      success: true,
      message: 'Monthly revenue comparison fetched successfully',
      data: result,
    };
  }

  async getSaleDistribution() {
    const startOfYear = dayjs().startOf('year').toDate();
    const endOfYear = dayjs().endOf('year').toDate();

    const [coinAgg, eventAgg] = await Promise.all([
      this.prisma.coinOrder.aggregate({
        where: {
          status: 'completed',
          created_at: {
            gte: startOfYear,
            lte: endOfYear,
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.eventOrder.aggregate({
        where: {
          status: 'completed',
          created_at: {
            gte: startOfYear,
            lte: endOfYear,
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const coinTotal = Number(coinAgg._sum.amount ?? 0);
    const eventTotal = Number(eventAgg._sum.amount ?? 0);
    const grandTotal = coinTotal + eventTotal;

    return {
      success: true,
      message: 'Current year sale distribution fetched successfully',
      data: {
        coin: {
          amount: coinTotal,
          percentage:
            grandTotal > 0
              ? Number(((coinTotal / grandTotal) * 100).toFixed(2))
              : 0,
        },
        event_ticket: {
          amount: eventTotal,
          percentage:
            grandTotal > 0
              ? Number(((eventTotal / grandTotal) * 100).toFixed(2))
              : 0,
        },
      },
    };
  }

  async getTopPerformingEvents(query: PaginationQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const startOfYear = dayjs().startOf('year').toDate();
    const endOfYear = dayjs().endOf('year').toDate();

    const topEvents = await this.prisma.eventTicket.findMany({
      where: {
        created_at: {
          gte: startOfYear,
          lte: endOfYear,
        },
        deleted_at: null,
      },
      select: {
        title: true,
        thumbnail: true,
        sold_limit: true,
        total_sold: true,
        ticket_price: true,
        event_date: true,
      },
      orderBy: {
        total_sold: 'desc',
      },
      skip,
      take: limit,
    });
    return {
      success: true,
      message: 'Top performing events fetched successfully',
      data: topEvents,
      meta_data: {
        total: topEvents.length,
        page,
        limit,
      },
    };
  }
}
