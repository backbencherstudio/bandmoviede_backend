import { Injectable } from '@nestjs/common';
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CoinService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllCoinBundle() {
    try {
      const coinBundle = await this.prisma.coinBundle.findMany({
        select: {
          id: true,
          name: true,
          price: true,
          coin_amount: true,
        },
      });
      return {
        success: true,
        data: coinBundle,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get coin bundle',
      };
    }
  }
}
