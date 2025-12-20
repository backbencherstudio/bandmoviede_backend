import { Controller, Get, Param, UseGuards, Post, Body, Req } from '@nestjs/common';
import { CoinService } from './coin.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@ApiTags('Coin')
@UseGuards(JwtAuthGuard)
@Controller('coin')
export class CoinController {
  constructor(private readonly coinService: CoinService) {}

  @Get('all')
  getAllCoinBundle() {
    return this.coinService.findAllCoinBundle();
  }

  @Get('bundle/:id')
  getCoinBundleById(@Param('id') id: string) {
    return this.coinService.findCoinBundleById(id);
  }

  @Post('order')
  createCoinOrder(@Body('bundle_id') bundle_id: string, @Req() req: any) {
    return this.coinService.createCoinOrder(req.user.sub, bundle_id);
  }
}
