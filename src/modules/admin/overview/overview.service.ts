import { Injectable } from '@nestjs/common';
import { CreateOverviewDto } from './dto/create-overview.dto';
import { UpdateOverviewDto } from './dto/update-overview.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as dayjs from 'dayjs';

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
      this.prisma.coinOrder.count({ where: { status: 'completed' } }),
      this.prisma.eventOrder.count({ where: { status: 'completed' } }),
      this.prisma.coinOrder.aggregate({
        _sum: { amount: true },
        where: { status: 'completed' },
      }),
      this.prisma.eventOrder.aggregate({
        _sum: { amount: true },
        where: { status: 'completed' },
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

  async getSalesAnalytics(period?: string) {
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
      WHERE status = 'completed' AND created_at >= $1
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
      WHERE status = 'completed' AND created_at >= $1
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

  async getUserActivity(year?: number) {
    const currentYear = year || new Date().getFullYear();

    // Get monthly active users from user_activities table
    const userActivity = await this.prisma.$queryRaw<any[]>`
      SELECT 
        EXTRACT(MONTH FROM activity_date) as month_num,
        TO_CHAR(activity_date, 'Mon') as month,
        COUNT(DISTINCT user_id) as active_users
      FROM user_activities
      WHERE EXTRACT(YEAR FROM activity_date) = ${currentYear}
      GROUP BY EXTRACT(MONTH FROM activity_date), TO_CHAR(activity_date, 'Mon')
      ORDER BY EXTRACT(MONTH FROM activity_date)
    `;

    // Get total registered users for calculating inactive
    const totalUsers = await this.prisma.user.count({
      where: {
        deleted_at: null,
        status: 1,
      },
    });

    // Initialize all 12 months
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
    const data = months.map((month, index) => {
      const found = userActivity.find(
        (item) => Number(item.month_num) === index + 1,
      );
      const activeCount = found ? Number(found.active_users) : 0;

      return {
        month,
        active_users: activeCount,
        inactive_users: totalUsers - activeCount,
      };
    });

    return {
      success: true,
      message: 'User activity analytics fetched successfully',
      data,
      meta: {
        year: currentYear,
        total_users: totalUsers,
      },
    };
  }
}
