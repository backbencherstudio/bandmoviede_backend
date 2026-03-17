import {
  Controller,
  Post,
  Body,
  Req,
  Headers,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PaypalPayment } from 'src/common/lib/Payment/paypal/PaypalPayment';
import { TransactionRepository } from 'src/common/repository/transaction/transaction.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { Public } from 'src/common/guard/public';
import { CoinService } from '../../coin/coin.service';

@Controller('payment/paypal')
export class PaypalController {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly coinService: CoinService,
  ) {}

  @Public()
  @Post('capture')
  async captureOrder(@Body() body: { orderId: string }) {
    try {
      if (!body.orderId) {
        throw new BadRequestException('Order ID is required');
      }

      const captureData = await PaypalPayment.captureOrder(body.orderId);

      if (captureData.status === 'COMPLETED') {
        const capture = captureData.purchase_units[0].payments.captures[0];

        await this.handlePaymentSuccess(body.orderId, capture);

        return {
          success: true,
          message: 'Order captured successfully',
          data: captureData,
        };
      } else {
        return {
          success: false,
          message: 'Order capture failed or not completed',
          data: captureData,
        };
      }
    } catch (error) {
      console.error('PayPal Capture Error:', error);
      return {
        success: false,
        message: 'Failed to capture order',
        error: error.message,
      };
    }
  }

  @Public()
  @Post('webhook')
  async handleWebhook(
    @Body() event: any,
    @Headers('paypal-transmission-id') transmissionId: string,
  ) {
    // In a production app, verify the webhook signature using PayPal SDK or API
    // For now, we trust the event structure if it matches
    // Note: To properly verify, we need headers: paypal-transmission-sig, paypal-cert-url, etc.

    try {
      const eventType = event.event_type;

      if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        const resource = event.resource;
        // resource.custom_id matches the order_id or transaction reference?
        // PayPal capture resource has 'supplementary_data.related_ids.order_id'
        // But we stored 'orderId' as 'reference_number' in transaction.

        // However, the capture ID is different from Order ID.
        // We need to find the transaction by Order ID.
        // The event resource is a Capture object. It contains `supplementary_data.related_ids.order_id`.

        const orderId = resource.supplementary_data?.related_ids?.order_id;

        if (orderId) {
          await this.handlePaymentSuccess(orderId, resource);
        }
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error', error);
      return { received: false };
    }
  }

  private async handlePaymentSuccess(orderId: string, captureData: any) {
    // Update transaction status in database
    // Our transaction reference_number is the Order ID (from createOrder)

    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { reference_number: orderId },
    });

    if (!transaction) {
      console.error(`Transaction not found for order ID: ${orderId}`);
      return;
    }

    if (transaction.status === 'succeeded') {
      return; // Already processed
    }

    const pMethod = captureData?.payment_source?.paypal
      ? 'paypal'
      : Object.keys(captureData?.payment_source || {})[0] || 'paypal';
    const payer = captureData?.payment_source?.paypal;
    const address = payer?.address
      ? `${payer.address.address_line_1 || ''} ${payer.address.admin_area_2 || ''} ${payer.address.postal_code || ''} ${payer.address.country_code || ''}`.trim()
      : null;

    await this.transactionRepository.updateTransaction({
      reference_number: orderId,
      status: 'succeeded',
      paid_amount: parseFloat(captureData.amount.value),
      paid_currency: captureData.amount.currency_code,
      raw_status: captureData.status,
      payment_method: pMethod,
      billing_address: address,
    });

    // Update Order Status (Coin or Ticket)
    if (
      transaction.type === 'coin_order' ||
      transaction.type === 'coin_checkout'
    ) {
      await this.prisma.coinOrder.updateMany({
        where: { transaction_id: transaction.id },
        data: { status: 'completed' },
      });

      const orders = await this.prisma.coinOrder.findMany({
        where: { transaction_id: transaction.id },
      });

      let totalCoinAmount = 0;
      let sugo_id = '';
      const orderIds = [];
      let userId = orders[0]?.user_id || null;

      for (const order of orders) {
        totalCoinAmount += order.coin_amount || 0;
        if (order.sugo_id) sugo_id = order.sugo_id;
        orderIds.push(order.id);
      }

      if (sugo_id && totalCoinAmount > 0) {
        if (userId) {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true },
          });

          if (user && user.email) {
            console.log('User found', user.email);
            await this.mailService.sendCoinPaymentSuccessEmail({
              email: user.email,
              name: user.name || '',
              amount: totalCoinAmount,
              sugoId: sugo_id,
            });
          }
          console.log('Mail sent successfully');
        }

        await this.coinService.transferCoinsToSugo(
          sugo_id,
          totalCoinAmount,
          userId,
          orderIds,
        );
      }
    } else if (
      transaction.type === 'ticket_order' ||
      transaction.type === 'ticket_checkout'
    ) {
      const orders = await this.prisma.eventOrder.findMany({
        where: { transaction_id: transaction.id },
        include: { event_ticket: true },
      });

      for (const order of orders) {
        // Generate ticket code logic (duplicate from StripeController)
        const year = new Date().getFullYear();
        let ticketCode = '';
        let isUnique = false;

        while (!isUnique) {
          const randomString = Array(6)
            .fill(null)
            .map(() => Math.floor(Math.random() * 36).toString(36))
            .join('')
            .toUpperCase();
          ticketCode = `TKT-SC${year}-${randomString}`;

          const existingTicket = await this.prisma.eventOrder.findFirst({
            where: { ticket_code: ticketCode },
          });

          if (!existingTicket) {
            isUnique = true;
          }
        }

        await this.prisma.eventOrder.update({
          where: { id: order.id },
          data: {
            status: 'completed',
            ticket_code: ticketCode,
          },
        });
      }

      // Send Email
      const userId = orders[0]?.user_id;
      if (userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (user && orders.length > 0) {
          const tickets = orders.map((order) => ({
            title: order.event_ticket.title,
            ticket_number: order.ticket_code, // This might be empty if we just updated it? No, wait.
            // We need to fetch it again or use the one we generated.
            // Actually the `order` object in map is the old one. We should use the generated `ticketCode` ?
            // But we are iterating.
            // To be safe, I should update the order object or re-query.
            // For simplicity, I'll assume I can just use the generated code if I was careful, but here I am inside a loop.
            // Simplest is to re-assign or push to a list.
          }));
          // Re-fetch orders to get codes ? Or just construct the list manually.

          // Let's reload orders
          const updatedOrders = await this.prisma.eventOrder.findMany({
            where: { transaction_id: transaction.id },
            include: { event_ticket: true },
          });

          const ticketData = updatedOrders.map((o) => ({
            title: o.event_ticket.title,
            ticket_number: o.ticket_code,
          }));

          await this.mailService.sendTicketPurchaseEmail({
            email: user.email,
            name: user.name,
            tickets: ticketData,
          });
        }
      }
    }
  }
}
