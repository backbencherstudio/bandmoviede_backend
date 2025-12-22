import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { FindAllQueryDto } from './dto/query-coin.dto';

@Injectable()
export class CoinService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllCoinBundle(query: FindAllQueryDto) {
    const [coinBundles, total] = await Promise.all([
      this.prisma.coinBundle.findMany({
        where: {
          status: 'Active',
        },
        select: {
          id: true,
          name: true,
          price: true,
          thumbnail: true,
          coin_amount: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.coinBundle.count(),
    ]);

    const data = coinBundles.map((bundle) => {
      return {
        ...bundle,
        thumbnail_url: bundle.thumbnail
          ? SojebStorage.url(
              appConfig().storageUrl.coinThumbnails + bundle.thumbnail,
            )
          : null,
      };
    });

    return {
      success: coinBundles.length > 0 ? true : false,
      message:
        coinBundles.length > 0
          ? 'Coin bundle retrieved successfully'
          : 'No coin bundle found',
      data: data,
      meta_data: {
        total: total || 0,
        page: query.page,
        limit: query.limit,
      },
    };
  }

  async findCoinBundleById(id: string) {
    if (!id) {
      throw new BadRequestException('Coin bundle id is required');
    }
    const coinBundle = await this.prisma.coinBundle.findUnique({
      where: {
        id: id,
        status: 'Active',
      },
      select: {
        id: true,
        name: true,
        price: true,
        thumbnail: true,
        coin_amount: true,
      },
    });

    if (!coinBundle) {
      throw new NotFoundException('Coin bundle not found');
    }

    const thumbnail_url = coinBundle.thumbnail
      ? SojebStorage.url(
          appConfig().storageUrl.coinThumbnails + coinBundle.thumbnail,
        )
      : null;

    return {
      success: true,
      message: 'Coin bundle retrieved successfully',
      data: { ...coinBundle, thumbnail_url },
    };
  }
}
