import { Controller, Get, Param, Query } from '@nestjs/common';
import { OverviewService } from './overview.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { UseGuards } from '@nestjs/common';

@Controller('admin/overview')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN)
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get('stats')
  getStats() {
    return this.overviewService.getStats();
  }

  @Get('sales-analytics')
  getSalesAnalytics(@Query('period') period?: string) {
    return this.overviewService.getSalesAnalytics(period);
  }

  @Get('user-activity')
  getUserActivity() {
    return this.overviewService.getUserActivity();
  }
}
