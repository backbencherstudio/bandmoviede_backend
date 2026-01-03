import { Controller, Get, Param, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { FindAllOrderQueryDto } from './dto/query-order.dto';

@Controller('admin/order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  findAll(@Query() query: FindAllOrderQueryDto) {
    return this.orderService.findAll(query);
  }
}
