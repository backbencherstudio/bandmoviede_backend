import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
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

  async create(
    userId: string,
    createCoinDto: CreateCoinDto,
    thumbnail?: Express.Multer.File,
  ) {
    const { price, coin_amount, is_active } = createCoinDto;

    if (price <= 0) {
      throw new BadRequestException('Price must be greater than or equal to 0');
    }
    if (coin_amount <= 0) {
      throw new BadRequestException(
        'Coin amount must be greater than or equal to 0',
      );
    }
    let name = StringHelper.randomString(8).toUpperCase();
    let isNameExist = await this.prisma.coinBundle.findFirst({
      where: { name },
    });

    while (isNameExist) {
      name = StringHelper.randomString(8).toUpperCase();
      isNameExist = await this.prisma.coinBundle.findFirst({
        where: { name },
      });
    }

    let fileName: string | null = null;

    if (thumbnail) {
      try {
        fileName = `${StringHelper.randomString()}${thumbnail.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.coinThumbnails + fileName,
          thumbnail.buffer,
        );
      } catch {
        throw new InternalServerErrorException('Failed to upload thumbnail');
      }
    }

    const coinBundle = await this.prisma.coinBundle.create({
      data: {
        name,
        price,
        coin_amount,
        user_id: userId,
        status: is_active ? 'Active' : 'Inactive',
        ...(fileName ? { thumbnail: fileName } : {}),
      },
      select: {
        id: true,
        name: true,
        price: true,
        coin_amount: true,
        status: true,
        created_at: true,
        updated_at: true,
        thumbnail: true,
      },
    });

    return {
      success: true,
      message: 'Coin bundle created successfully',
      data: {
        ...coinBundle,
        thumbnail: coinBundle.thumbnail
          ? SojebStorage.url(
              appConfig().storageUrl.coinThumbnails + coinBundle.thumbnail,
            )
          : null,
      },
    };
  }

  async findAll(query: FindAllQueryDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const take = limit;
    const where: Prisma.CoinBundleWhereInput = {};
    if (search) {
      const numSearch = Number(search);
      const isNumber = !isNaN(numSearch);
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];

      if (search.toLowerCase() === 'active') {
        where.OR.push({ status: 'Active' });
      } else if (search.toLowerCase() === 'inactive') {
        where.OR.push({ status: 'Inactive' });
      }

      if (isNumber) {
        where.OR.push(
          { price: numSearch },
          { coin_amount: numSearch },
          { total_sold: numSearch },
        );
      }
    }

    const [data, count] = await Promise.all([
      this.prisma.coinBundle.findMany({
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
        orderBy: {
          created_at: 'desc',
        },
        where,
        skip,
        take,
      }),
      this.prisma.coinBundle.count({ where }),
    ]);
    return {
      success: data.length > 0 ? true : false,
      message:
        data.length > 0
          ? 'Coin bundles fetched successfully'
          : 'No coin bundles found',
      data,
      meta_data: {
        page,
        limit,
        total: count,
      },
    };
  }

  async findOne(id: string) {
    if (!id) {
      throw new BadRequestException('Coin bundle id is required');
    }
    const coinBundle = await this.prisma.coinBundle.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        price: true,
        coin_amount: true,
        total_sold: true,
        status: true,
        created_at: true,
        updated_at: true,
        thumbnail: true,
      },
    });

    if (!coinBundle) {
      throw new NotFoundException('Coin bundle not found');
    }

    return {
      success: true,
      message: 'Coin bundle fetched successfully',
      data: coinBundle && {
        ...coinBundle,
        thumbnail: coinBundle?.thumbnail
          ? SojebStorage.url(
              appConfig().storageUrl.coinThumbnails + coinBundle.thumbnail,
            )
          : null,
      },
    };
  }

  async update(
    id: string,
    updateCoinDto: UpdateCoinDto,
    thumbnail?: Express.Multer.File,
  ) {
    if (!id) {
      throw new BadRequestException('Coin bundle id is required');
    }
    const { is_active, ...rest } = updateCoinDto;

    const existing = await this.prisma.coinBundle.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Coin bundle not found');
    }

    if (rest.price !== undefined && rest.price <= 0) {
      throw new BadRequestException('Price must be greater than or equal to 0');
    }

    let fileName: string | null = null;
    if (thumbnail) {
      try {
        fileName = `${StringHelper.randomString()}${thumbnail.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.coinThumbnails + fileName,
          thumbnail.buffer,
        );
      } catch {
        throw new InternalServerErrorException('Thumbnail upload failed');
      }
    }

    const coinBundle = await this.prisma.coinBundle.update({
      where: { id },
      data: {
        ...rest,
        ...(is_active !== undefined
          ? { status: is_active ? 'Active' : 'Inactive' }
          : {}),
        ...(fileName ? { thumbnail: fileName } : {}),
      },
      select: {
        id: true,
        name: true,
        price: true,
        coin_amount: true,
        status: true,
        created_at: true,
        updated_at: true,
        thumbnail: true,
      },
    });

    return {
      success: true,
      message: 'Coin bundle updated successfully',
      data: {
        ...coinBundle,
        thumbnail: coinBundle.thumbnail
          ? SojebStorage.url(
              appConfig().storageUrl.coinThumbnails + coinBundle.thumbnail,
            )
          : null,
      },
    };
  }

  async remove(id: string) {
    if (!id) {
      throw new BadRequestException('Coin bundle id is required');
    }
    const existing = await this.prisma.coinBundle.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Coin bundle not found');
    }
    await this.prisma.coinBundle.delete({ where: { id } });
    return {
      success: true,
      message: 'Coin bundle deleted successfully',
    };
  }
}
