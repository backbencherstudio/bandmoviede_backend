import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PaginationQueryDto } from './dto/query-analytics.dto';

@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('monthly-revenue-comparison')
  async getMonthlyRevenueComparison() {
    return this.analyticsService.getMonthlyRevenueComparison();
  }

  @Get('sale-distribution')
  async getSaleDistribution() {
    return this.analyticsService.getSaleDistribution();
  }

  @Get('top-performing-events')
  async getTopPerformingEvents(@Query() query: PaginationQueryDto) {
    return this.analyticsService.getTopPerformingEvents(query);
  }
}
