import { Controller, Get, UseGuards } from '@nestjs/common';
import { OwnerService } from './owner.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN)
@Controller('admin/owner')
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  @Get('info')
  findOwnerInfo() {
    return this.ownerService.findOwnerInfo();
  }

  @Get('coins')
  findOwnerCoins() {
    return this.ownerService.findOwnerCoins();
  }
}
