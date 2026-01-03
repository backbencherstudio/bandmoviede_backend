import { Injectable } from '@nestjs/common';
import { CreateOverviewDto } from './dto/create-overview.dto';
import { UpdateOverviewDto } from './dto/update-overview.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import dayjs from 'dayjs';

@Injectable()
export class OverviewService {
  constructor(private prisma: PrismaService) {}
  async getStats() {
    const [
      totalActiveUsers,
      totalCoinSold,
      totalTicketSold,
      coinRevenue,
      ticketRevenue,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: 1, deleted_at: null } }),
      this.prisma.coinOrder.count({ where: { status: 'complete' } }),
      this.prisma.eventOrder.count({ where: { status: 'complete' } }),
      this.prisma.coinOrder.aggregate({
        _sum: { amount: true },
        where: { status: 'complete' },
      }),
      this.prisma.eventOrder.aggregate({
        _sum: { amount: true },
        where: { status: 'complete' },
      }),
    ]);
    return {
      success: true,
      message: 'Stats fetched successfully',
      data: {
        total_active_users: totalActiveUsers,
        total_coin_sold: totalCoinSold,
        total_ticket_sold: totalTicketSold,
        total_revenue:
          (coinRevenue._sum.amount ?? 0) + (ticketRevenue._sum.amount ?? 0),
      },
    };
  }

  async getSalesAnalytics(period: string) {
    const now = dayjs();
    let startDate: dayjs.Dayjs;
    let groupBy: 'day' | 'month' | 'week' = 'day';

    switch (period) {
      case 'lastYear':
        startDate = now.subtract(1, 'year').startOf('month');
        groupBy = 'month';
        break;
      case 'lastThreeMonth':
        startDate = now.subtract(3, 'month').startOf('month');
        groupBy = 'month';
        break;
      case 'lastMonth':
        startDate = now.subtract(1, 'month').startOf('day');
        groupBy = 'day';
        break;
      case 'lastSevenDay':
      default:
        startDate = now.subtract(7, 'day').startOf('day');
        groupBy = 'day';
        break;
    }

    const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';

    const coinRevenueQuery = this.prisma.$queryRawUnsafe<
      { date: string; revenue: number }[]
    >(
      `
      SELECT TO_CHAR(created_at, '${groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'}') as date, SUM(amount) as revenue
      FROM coin_orders
      WHERE status = 'complete' AND created_at >= $1
      GROUP BY date
      ORDER BY date ASC
    `,
      startDate.toDate(),
    );

    const eventRevenueQuery = this.prisma.$queryRawUnsafe<
      { date: string; revenue: number }[]
    >(
      `
      SELECT TO_CHAR(created_at, '${groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'}') as date, SUM(amount) as revenue
      FROM event_orders
      WHERE status = 'complete' AND created_at >= $1
      GROUP BY date
      ORDER BY date ASC
    `,
      startDate.toDate(),
    );

    const [coinRevenue, eventRevenue] = await Promise.all([
      coinRevenueQuery,
      eventRevenueQuery,
    ]);

    const analyticsMap = new Map<string, number>();

    // Initialize map with all dates in range to ensure zero values are present
    let current = startDate;
    while (current.isBefore(now) || current.isSame(now, groupBy)) {
      const label = current.format(dateFormat);
      analyticsMap.set(label, 0);
      current = current.add(1, groupBy);
    }

    // Merge coin revenue
    coinRevenue.forEach((row) => {
      if (analyticsMap.has(row.date)) {
        analyticsMap.set(
          row.date,
          analyticsMap.get(row.date) + Number(row.revenue || 0),
        );
      }
    });

    // Merge event revenue
    eventRevenue.forEach((row) => {
      if (analyticsMap.has(row.date)) {
        analyticsMap.set(
          row.date,
          analyticsMap.get(row.date) + Number(row.revenue || 0),
        );
      }
    });

    const data = Array.from(analyticsMap.entries()).map(([label, value]) => ({
      label,
      value,
    }));

    return {
      success: true,
      message: 'Sales analytics fetched successfully',
      data,
    };
  }

  async getUserActivity() {
    const now = dayjs();
    const startDate = now.subtract(11, 'month').startOf('month');

    const users = await this.prisma.user.findMany({
      where: {
        created_at: { gte: startDate.toDate() },
        deleted_at: null,
      },
      select: {
        status: true,
        created_at: true,
      },
    });

    const activityMap = new Map<string, { active: number; inactive: number }>();

    // Initialize map with last 12 months
    let current = startDate;
    for (let i = 0; i < 12; i++) {
      const monthLabel = current.format('MMM'); // e.g., "Jan", "Feb"
      activityMap.set(monthLabel, { active: 0, inactive: 0 });
      current = current.add(1, 'month');
    }

    users.forEach((user) => {
      const monthLabel = dayjs(user.created_at).format('MMM');
      if (activityMap.has(monthLabel)) {
        const stats = activityMap.get(monthLabel);
        if (user.status === 1) {
          stats.active++;
        } else {
          stats.inactive++;
        }
      }
    });

    const data = Array.from(activityMap.entries()).map(([month, stats]) => ({
      month,
      active: stats.active,
      inactive: stats.inactive,
    }));

    return {
      success: true,
      message: 'User activity analytics fetched successfully',
      data,
    };
  }
}
