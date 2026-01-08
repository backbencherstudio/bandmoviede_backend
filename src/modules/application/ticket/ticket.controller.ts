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
import { CheckoutTicketDto } from './dto/checkout-ticket.dto';
import {
  CreateTicketCheckoutDto,
  UpdateTicketCheckoutDto,
} from './dto/ticket-checkout.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Public } from 'src/common/guard/public';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiTags('Ticket')
@Controller('ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Public()
  @Get('all')
  findAll(@Query() query: FindAllQueryDto) {
    return this.ticketService.findAll(query);
  }

  // --- Draft CRUD ---

  @Post('checkout')
  createCheckoutDraft(@Body() body: CreateTicketCheckoutDto, @Req() req: any) {
    return this.ticketService.createCheckoutDraft(req.user.userId, body);
  }

  @Get('checkout')
  getCheckoutDrafts(@Req() req: any) {
    console.log(req.user.userId);
    return this.ticketService.getCheckoutDrafts(req.user.userId);
  }

  @Get('checkout/:id')
  getCheckoutDraft(@Param('id') id: string, @Req() req: any) {
    return this.ticketService.getCheckoutDraft(req.user.userId, id);
  }

  @Patch('checkout/:id')
  updateCheckoutDraft(
    @Param('id') id: string,
    @Body() body: UpdateTicketCheckoutDto,
    @Req() req: any,
  ) {
    return this.ticketService.updateCheckoutDraft(req.user.userId, id, body);
  }

  @Delete('checkout/:id')
  deleteCheckoutDraft(@Param('id') id: string, @Req() req: any) {
    return this.ticketService.deleteCheckoutDraft(req.user.userId, id);
  }

  @Public()
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

  // checkout order
  @Post('checkout/order')
  checkout(@Body() body: CheckoutTicketDto, @Req() req: any) {
    const userId = req.user.userId;
    return this.ticketService.checkout(userId, body);
  }
}
