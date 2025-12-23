import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { FindAllQueryDto } from './dto/query-ticket.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';



@ApiBearerAuth()
@ApiTags('Ticket')
@UseGuards(JwtAuthGuard)
@Controller('ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) { }



  @Get('all')
  findAll(@Query() query: FindAllQueryDto) {
    return this.ticketService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketService.findOne(id);
  }



  // create ticket order
  @Post('order')
  createTicketOrder(@Body() body: { ticket_id: string }, @Req() req: any) {
    const userId = req.user.userId;
    return this.ticketService.createTicketOrder(userId, body.ticket_id);
  }
}
