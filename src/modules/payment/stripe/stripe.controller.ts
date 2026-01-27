import { Controller, Post, Req, Headers } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { MailService } from 'src/mail/mail.service';
import { TransactionRepository } from '../../../common/repository/transaction/transaction.repository';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('payment/stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private transactionRepository: TransactionRepository,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ) {
    try {
      const payload = req.rawBody.toString();
      const event = await this.stripeService.handleWebhook(payload, signature);
      // Handle events
      switch (event.type) {
        case 'customer.created':
          break;
        case 'payment_intent.created':
          break;
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          // create tax transaction
          // await StripePayment.createTaxTransaction(
          //   paymentIntent.metadata['tax_calculation'],
          // );
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: paymentIntent.id,
            status: 'succeeded',
            paid_amount: paymentIntent.amount / 100, // amount in dollars
            paid_currency: paymentIntent.currency,
            raw_status: paymentIntent.status,
          });

          if (paymentIntent.metadata['type'] === 'coin_order') {
            await this.prisma.coinOrder.updateMany({
              where: {
                transaction: {
                  reference_number: paymentIntent.id,
                },
              },
              data: {
                status: 'completed',
              },
            });
          } else if (paymentIntent.metadata['type'] === 'coin_checkout') {
            await this.prisma.coinOrder.updateMany({
              where: {
                transaction: {
                  reference_number: paymentIntent.id,
                },
              },
              data: {
                status: 'completed',
              },
            });
          } else if (paymentIntent.metadata['type'] === 'ticket_order') {
            // Generate ticket code
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
                where: {
                  ticket_code: ticketCode,
                },
              });

              if (!existingTicket) {
                isUnique = true;
              }
            }

            await this.prisma.eventOrder.updateMany({
              where: {
                transaction: {
                  reference_number: paymentIntent.id,
                },
              },
              data: {
                status: 'completed',
                ticket_code: ticketCode,
              },
            });

            console.log('Stripe Webhook: Accessing ticket_order email block');
            const userId = paymentIntent.metadata['user_id'];
            console.log('Stripe Webhook: userId from metadata:', userId);

            if (userId) {
              const user = await this.prisma.user.findUnique({
                where: { id: userId },
              });
              console.log(
                'Stripe Webhook: User found:',
                user ? user.email : 'No user',
              );

              const updatedOrders = await this.prisma.eventOrder.findMany({
                where: {
                  transaction: {
                    reference_number: paymentIntent.id,
                  },
                },
                include: {
                  event_ticket: true,
                },
              });
              console.log(
                'Stripe Webhook: Updated orders count:',
                updatedOrders.length,
              );

              if (user && updatedOrders.length > 0) {
                const tickets = updatedOrders.map((order) => ({
                  title: order.event_ticket.title,
                  ticket_number: order.ticket_code,
                }));
                console.log(
                  'Stripe Webhook: Sending email with tickets:',
                  tickets,
                );

                await this.mailService.sendTicketPurchaseEmail({
                  email: user.email,
                  name: user.name,
                  tickets: tickets,
                });
                console.log('Stripe Webhook: Email queued');
              } else {
                console.log(
                  'Stripe Webhook: Skipping email - User or Orders missing',
                );
              }
            } else {
              console.log('Stripe Webhook: No userId in metadata');
            }
          } else if (paymentIntent.metadata['type'] === 'ticket_checkout') {
            // Find all orders for this transaction
            const orders = await this.prisma.eventOrder.findMany({
              where: {
                transaction: {
                  reference_number: paymentIntent.id,
                },
              },
            });

            for (const order of orders) {
              // Generate unique ticket code for each order
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

            // Send email for checkout
            const userId = paymentIntent.metadata['user_id'];
            console.log(
              'Stripe Webhook (Checkout): userId from metadata:',
              userId,
            );

            if (userId) {
              const user = await this.prisma.user.findUnique({
                where: { id: userId },
              });
              console.log(
                'Stripe Webhook (Checkout): User found:',
                user ? user.email : 'No user',
              );

              const updatedOrders = await this.prisma.eventOrder.findMany({
                where: {
                  transaction: {
                    reference_number: paymentIntent.id,
                  },
                },
                include: {
                  event_ticket: true,
                },
              });
              console.log(
                'Stripe Webhook (Checkout): Updated orders count:',
                updatedOrders.length,
              );

              if (user && updatedOrders.length > 0) {
                const tickets = updatedOrders.map((order) => ({
                  title: order.event_ticket.title,
                  ticket_number: order.ticket_code,
                }));
                console.log(
                  'Stripe Webhook (Checkout): Sending email with tickets:',
                  tickets,
                );

                await this.mailService.sendTicketPurchaseEmail({
                  email: user.email,
                  name: user.name,
                  tickets: tickets,
                });
                console.log('Stripe Webhook (Checkout): Email queued');
              } else {
                console.log(
                  'Stripe Webhook (Checkout): Skipping email - User or Orders missing',
                );
              }
            } else {
              console.log('Stripe Webhook (Checkout): No userId in metadata');
            }
          }
          break;
        case 'payment_intent.payment_failed':
          const failedPaymentIntent = event.data.object;
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: failedPaymentIntent.id,
            status: 'failed',
            raw_status: failedPaymentIntent.status,
          });
        case 'payment_intent.canceled':
          const canceledPaymentIntent = event.data.object;
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: canceledPaymentIntent.id,
            status: 'canceled',
            raw_status: canceledPaymentIntent.status,
          });
          break;
        case 'payment_intent.requires_action':
          const requireActionPaymentIntent = event.data.object;
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: requireActionPaymentIntent.id,
            status: 'requires_action',
            raw_status: requireActionPaymentIntent.status,
          });
          break;
        case 'payout.paid':
          const paidPayout = event.data.object;
          console.log(paidPayout);
          break;
        case 'payout.failed':
          const failedPayout = event.data.object;
          console.log(failedPayout);
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error', error);
      return { received: false };
    }
  }
}
