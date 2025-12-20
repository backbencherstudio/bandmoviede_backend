import { Controller, Get, UseGuards } from '@nestjs/common';
import { CoinService } from './coin.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

// @ApiBearerAuth()
@ApiTags('Coin')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.USER)
@Controller('coin')
export class CoinController {
  constructor(private readonly coinService: CoinService) {}

  @Get()
  getAllCoinBundle() {
    return this.coinService.findAllCoinBundle();
  }
}
