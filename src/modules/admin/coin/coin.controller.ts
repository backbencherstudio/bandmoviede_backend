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
  Query,
  BadRequestException,
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
import { Request } from 'express';
import { FindAllQueryDto } from './dto/query-coin.dto';

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
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  createCoinBundle(
    @Req() req: Request,
    @Body() createCoinDto: CreateCoinDto,
    @UploadedFile() thumbnail: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    return this.coinService.create(userId, createCoinDto, thumbnail);
  }

  @Get('all')
  findAll(@Query() query: FindAllQueryDto) {
    return this.coinService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coinService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  updateCoinBundle(
    @Param('id') id: string,
    @Body() updateCoinDto: UpdateCoinDto,
    @UploadedFile() thumbnail: Express.Multer.File,
  ) {
    return this.coinService.update(id, updateCoinDto, thumbnail);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coinService.remove(id);
  }
}
