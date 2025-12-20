import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service'; // Assuming PrismaService is in src/prisma/prisma.service
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

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

  findAll() {
    return this.prisma.coinBundle.findMany();
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
