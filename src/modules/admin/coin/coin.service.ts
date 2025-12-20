import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service'; // Assuming PrismaService is in src/prisma/prisma.service
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { FindAllQueryDto } from './dto/query-coin.dto';
import { Prisma } from 'prisma/generated/client';

@Injectable()
export class CoinService {
  constructor(private readonly prisma: PrismaService) {}

  async createCoinBundle(
    userId: string,
    createCoinDto: CreateCoinDto,
    thumbnail?: Express.Multer.File,
  ) {
    const { price, coin_amount } = createCoinDto;
    // Generate a random 8-character string for name
    const name = StringHelper.randomString(8).toUpperCase();
    let fileName: string | null = null;
    if (thumbnail) {
      fileName = `${StringHelper.randomString()}${thumbnail.originalname}`;
      await SojebStorage.put(
        appConfig().storageUrl.coinThumbnails + fileName,
        thumbnail.buffer,
      );
    }

    await this.prisma.coinBundle.create({
      data: {
        name,
        price,
        coin_amount,
        user_id: userId,
        ...(thumbnail && fileName ? { thumbnail: fileName } : {}),
      },
    });
    return {
      success: true,
      message: 'Coin bundle created successfully',
    };
  }

  async findAll(query: FindAllQueryDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const take = limit;
    const where: Prisma.CoinBundleWhereInput = {};
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
      if (search === 'active') {
        where.status = 'Active';
      } else if (search === 'inactive') {
        where.status = 'Inactive';
      }
      // if(Number(search)){
      //   where.OR={
      //     price:{

      //     }
      //   };
      // }
    }

    const data = await this.prisma.coinBundle.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        coin_amount: true,
        total_sold: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.coinBundle.findUnique({ where: { id } });
  }

  update(id: string, updateCoinDto: UpdateCoinDto) {
    return this.prisma.coinBundle.update({
      where: { id },
      data: updateCoinDto,
    });
  }

  remove(id: string) {
    return this.prisma.coinBundle.delete({ where: { id } });
  }
}
