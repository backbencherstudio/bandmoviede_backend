import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Post,
  Body,
  Req,
  Patch,
  Delete,
} from '@nestjs/common';
import { CoinService } from './coin.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { FindAllQueryDto } from './dto/query-coin.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CheckoutCoinDto } from './dto/checkout-coin.dto';
import {
  CreateCoinCheckoutDto,
  UpdateCoinCheckoutDto,
} from './dto/coin-checkout.dto';
import { Public } from 'src/common/guard/public';

@ApiBearerAuth()
@ApiTags('Coin')
@Controller('coin')
export class CoinController {
  constructor(private readonly coinService: CoinService) {}

  @Public()
  @Get('all')
  getAllCoinBundle(@Query() query: FindAllQueryDto) {
    return this.coinService.findAllCoinBundle(query);
  }

  @Public()
  @Get('custom')
  getCustomCoinBundle() {
    return this.coinService.findCustomCoinBundle();
  }

  @Public()
  @Get('bundle/:id')
  getCoinBundleById(@Param('id') id: string) {
    return this.coinService.findCoinBundleById(id);
  }

  @Post('order')
  createCoinOrder(@Body() body: CreateOrderDto, @Req() req: any) {
    return this.coinService.createCoinOrder(
      req.user.userId,
      body.bundle_id,
      body.sugo_id,
      body.quantity || 1,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('checkout/order')
  checkout(@Body() body: CheckoutCoinDto, @Req() req: any) {
    const userId = req.user?.userId || null;
    return this.coinService.checkout(userId, body);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('paypal/checkout/order')
  paypalCheckout(@Body() body: CheckoutCoinDto, @Req() req: any) {
    const userId = req.user?.userId || null;
    return this.coinService.paypalCheckout(body, userId);
  }

  // --- Checkout CRUD ---

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  createCheckoutDraft(@Body() body: CreateCoinCheckoutDto, @Req() req: any) {
    const userId = req.user?.userId || null;
    return this.coinService.createCheckoutDraft(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('checkout')
  getCheckoutDrafts(@Req() req: any) {
    return this.coinService.getCheckoutDrafts(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('checkout/:id')
  getCheckoutDraft(@Param('id') id: string, @Req() req: any) {
    return this.coinService.getCheckoutDraft(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('checkout/:id')
  updateCheckoutDraft(
    @Param('id') id: string,
    @Body() body: UpdateCoinCheckoutDto,
    @Req() req: any,
  ) {
    return this.coinService.updateCheckoutDraft(req.user.userId, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('checkout/:id')
  deleteCheckoutDraft(@Param('id') id: string, @Req() req: any) {
    return this.coinService.deleteCheckoutDraft(req.user.userId, id);
  }
}
