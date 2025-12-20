import { Injectable } from '@nestjs/common';
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class CoinService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllCoinBundle() {
    try {
      const coinBundles = await this.prisma.coinBundle.findMany({
        select: {
          id: true,
          name: true,
          price: true,
          thumbnail: true,
          coin_amount: true,
        },
      });

      if (!coinBundles) {
        return {
          success: false,
          message: 'Coin bundle not found',
        };
      }

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
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get coin bundle',
      };
    }
  }

  async findCoinBundleById(id: string) {
    try {
      const coinBundle = await this.prisma.coinBundle.findUnique({
        where: {
          id: id,
        },
      });

      if (!coinBundle) {
        return {
          success: false,
          message: 'Coin bundle not found',
        };
      }

      const thumbnail_url = coinBundle.thumbnail
        ? SojebStorage.url(
            appConfig().storageUrl.coinThumbnails + coinBundle.thumbnail,
          )
        : null;

      return {
        success: true,
        data: { ...coinBundle, thumbnail_url },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get coin bundle',
      };
    }
  }
}
