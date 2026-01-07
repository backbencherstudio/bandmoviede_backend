import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';

@Injectable()
export class OwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  // get owner info
  async findOwnerInfo() {
    try {
      const url = process.env.SUGO_OWNER_INFO_GET + process.env.COIN_SELLER_ID;

      const { data } = await axios.get(url);
      return {
        success: true,
        message: 'Owner info fetched successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get owner info',
      };
    }
  }

  //get owner coins
  async findOwnerCoins() {
    try {
      const url = process.env.SUGO_OWNER_COIN_GET + process.env.COIN_SELLER_ID;
      const { data } = await axios.get(url);
      return {
        success: true,
        message: 'Owner coins fetched successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get owner coins',
      };
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCron() {
    const res = await this.findOwnerCoins();

    if (res.success && res.data?.balance) {
      const balance = parseFloat(res.data.balance);
      const limit = parseFloat(process.env.LOW_BALANCE_LIMIT || '300');

      if (balance < limit) {
        const admins = await this.prisma.user.findMany({
          where: {
            type: 'admin',
          },
          select: {
            id: true,
          },
        });

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            const lowBalanceAlertPayload: any = {
              sender_id: null,
              receiver_id: admin.id,
              text: `Owner coin balance is low: ${balance}. Limit: ${limit}`,
              type: 'owner_coin_low',
            };

            const hasSentToday =
              await this.notificationRepository.hasTodayNotification(
                admin.id,
                'owner_coin_low',
              );

            if (hasSentToday) {
              // console.log(
              //   `Notification already sent to user ${admin.id} today`,
              // );
              continue;
            }

            const userSocketId = this.messageGateway.clients.get(admin.id);

            if (userSocketId) {
              this.messageGateway.server
                .to(userSocketId)
                .emit('lowBalanceAlert', lowBalanceAlertPayload);
            }

            await this.notificationRepository.createNotification(
              lowBalanceAlertPayload,
            );
          }
        }
      }
    }
  }
}
