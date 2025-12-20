import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CoinService } from './coin.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { FindAllQueryDto } from './dto/query-coin.dto';

// @ApiBearerAuth()
@ApiTags('Coin')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.USER)
@Controller('coin')
export class CoinController {
  constructor(private readonly coinService: CoinService) {}

  @Get('all')
  getAllCoinBundle(@Query() query: FindAllQueryDto) {
    return this.coinService.findAllCoinBundle(query);
  }

  @Get('bundle/:id')
  getCoinBundleById(@Param('id') id: string) {
    return this.coinService.findCoinBundleById(id);
  }
}
