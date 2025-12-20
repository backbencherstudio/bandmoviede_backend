import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { CoinService } from './coin.service';
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@ApiBearerAuth()
@ApiTags('Coin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/coin')
export class CoinController {
  constructor(private readonly coinService: CoinService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      storage: memoryStorage(),
    }),
  )
  createCoinBundle(
    @Req() req: any,
    @Body() createCoinDto: CreateCoinDto,
    @UploadedFile() thumbnail: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    return this.coinService.createCoinBundle(userId, createCoinDto, thumbnail);
  }

  @Get()
  findAll() {
    return this.coinService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coinService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCoinDto: UpdateCoinDto) {
    return this.coinService.update(id, updateCoinDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coinService.remove(id);
  }
}
