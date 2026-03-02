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
    const { price, coin_amount = 0, is_active, is_custom } = createCoinDto;
    if (!is_custom && coin_amount < 750) {
      throw new BadRequestException('Coin amount must be at least 750');
    }
    if (price <= 0) {
      throw new BadRequestException('Price must be greater than or equal to 0');
    }

    if (is_custom) {
      const existingCustom = await this.prisma.coinBundle.findFirst({
        where: { is_custom: true, deleted_at: null },
      });
      if (existingCustom) {
        throw new BadRequestException('A custom coin bundle already exists');
      }
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

    await this.prisma.coinBundle.create({
      data: {
        name,
        price,
        coin_amount,
        user_id: userId,
        status: is_active ? 'Active' : 'Inactive',
        is_custom: is_custom || false,
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
        is_custom: true,
      },
    });

    return {
      success: true,
      message: 'Coin bundle created successfully',
    };
  }

  async findAll(query: FindAllQueryDto) {
    const { search, page = 1, limit = 10, filter = 'all' } = query;
    const skip = (page - 1) * limit;
    const take = limit;
    const where: Prisma.CoinBundleWhereInput = {
      deleted_at: null,
      is_custom: false,
    };

    // Build date filter conditions
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (filter) {
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case 'last_year':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        break;
    }

    // Add date filter to where clause
    if (startDate && endDate) {
      where.created_at = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Add search filter
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
        filter,
      },
    };
  }

  async findOne(id: string) {
    if (!id) {
      throw new BadRequestException('Coin bundle id is required');
    }
    const coinBundle = await this.prisma.coinBundle.findUnique({
      where: { id, deleted_at: null },
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

  async findCustomCoinBundle() {
    const coinBundle = await this.prisma.coinBundle.findFirst({
      where: { is_custom: true, deleted_at: null },
      select: {
        id: true,
        name: true,
        price: true,
        coin_amount: true,
        total_sold: true,
        is_custom: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!coinBundle) {
      throw new NotFoundException('Coin bundle not found');
    }

    return {
      success: true,
      message: 'Coin bundle fetched successfully',
      data: coinBundle,
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

    const existing = await this.prisma.coinBundle.findUnique({
      where: { id, deleted_at: null },
    });

    if (!existing) {
      throw new NotFoundException('Coin bundle not found');
    }

    if (updateCoinDto.coin_amount) {
      if (!existing.is_custom) {
        if (updateCoinDto.coin_amount < 750) {
          throw new BadRequestException('Coin amount must be at least 750');
        }
      }
    }

    const { is_active = true, ...rest } = updateCoinDto;

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

    await this.prisma.coinBundle.update({
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
        is_custom: true,
      },
    });

    return {
      success: true,
      message: 'Coin bundle updated successfully',
    };
  }

  async remove(id: string) {
    if (!id) {
      throw new BadRequestException('Coin bundle id is required');
    }
    const existing = await this.prisma.coinBundle.findUnique({
      where: { id, deleted_at: null },
    });

    if (!existing) {
      throw new NotFoundException('Coin bundle not found');
    }
    await this.prisma.coinBundle.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });
    if (existing.thumbnail) {
      await SojebStorage.delete(
        appConfig().storageUrl.coinThumbnails + existing.thumbnail,
      );
    }
    return {
      success: true,
      message: 'Coin bundle deleted successfully',
    };
  }

  async getStats() {
    const [
      totalCoinBundles,
      totalActiveCoinBundles,
      totalInactiveCoinBundles,
      coinOrderStats,
    ] = await Promise.all([
      this.prisma.coinBundle.count({ where: { deleted_at: null } }),
      this.prisma.coinBundle.count({
        where: { deleted_at: null, status: 'Active' },
      }),
      this.prisma.coinBundle.count({
        where: { deleted_at: null, status: 'Inactive' },
      }),
      this.prisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(SUM(o.amount), 0) as "total_revenue",
        COALESCE(SUM(o.quantity * cb.coin_amount), 0) as "total_coin_sold"
      FROM coin_orders o
      LEFT JOIN coin_bundles cb ON o.coin_bundle_id = cb.id
      WHERE o.status = 'completed'
    `,
    ]);

    const orderStats = coinOrderStats[0] || {
      total_revenue: 0,
      total_coin_sold: 0,
    };

    return {
      success: true,
      message: 'Coin stats fetched successfully',
      data: {
        total_coin_bundles: Number(totalCoinBundles || 0),
        total_active_coin_bundles: Number(totalActiveCoinBundles || 0),
        total_inactive_coin_bundles: Number(totalInactiveCoinBundles || 0),
        total_coin_sold: Number(orderStats.total_coin_sold || 0),
        total_revenue: Number(orderStats.total_revenue || 0),
      },
    };
  }
}
