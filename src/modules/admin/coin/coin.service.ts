import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service'; // Assuming PrismaService is in src/prisma/prisma.service
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';

@Injectable()
export class CoinService {
  constructor(private readonly prisma: PrismaService) {}

  async createCoinBundle(createCoinDto: CreateCoinDto) {
    const { name, price, coin_amount } = createCoinDto;
    return await this.prisma.coinBundle.create({
      data: {
        name,
        price,
        coin_amount,
      },
    });
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
