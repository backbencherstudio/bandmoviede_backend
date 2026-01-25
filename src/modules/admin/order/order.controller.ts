import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { FindAllOrderQueryDto } from './dto/query-order.dto';
import { UpdateTicketUsageDto } from './dto/update-ticket-usage.dto';

@Controller('admin/order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  findAll(@Query() query: FindAllOrderQueryDto) {
    return this.orderService.findAll(query);
  }

  @Patch('ticket/:id/usage')
  updateTicketUsage(
    @Param('id') id: string,
    @Body() updateTicketUsageDto: UpdateTicketUsageDto,
  ) {
    return this.orderService.updateTicketUsage(id, updateTicketUsageDto.used);
  }
}
