import { Controller, Get, Param, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { FindAllOrderQueryDto } from './dto/query-order.dto';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  findAll(@Query() query: FindAllOrderQueryDto) {
    return this.orderService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(+id);
  }
}
