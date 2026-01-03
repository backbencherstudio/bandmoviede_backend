import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { OrderService } from './order.service';
import {
  FindAllOrderQueryDto,
  FindEventTicketsQueryDto,
} from './dto/query-order.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Request } from 'express';

@Controller('order')
@UseGuards(JwtAuthGuard)
@Roles(Role.USER)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  findAll(@Query() query: FindAllOrderQueryDto, @Req() req: Request) {
    return this.orderService.findAll(query, req.user.userId);
  }

  @Get('stats')
  getStats(@Req() req: Request) {
    return this.orderService.getStats(req.user.userId);
  }

  @Get('tickets')
  findEventTickets(
    @Query() query: FindEventTicketsQueryDto,
    @Req() req: Request,
  ) {
    return this.orderService.findEventTickets(req.user.userId, query);
  }
}
