import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import appConfig from '../config/app.config';

@Injectable()
export class MailService {
  constructor(
    @InjectQueue('mail-queue') private queue: Queue,
    private mailerService: MailerService,
  ) {}

  async sendMemberInvitation({ user, member, url }) {
    try {
      const from = `${process.env.APP_NAME} <${appConfig().mail.from}>`;
      const subject = `${user.fname} is inviting you to ${appConfig().app.name}`;

      // add to queue
      await this.queue.add('sendMemberInvitation', {
        to: member.email,
        from: from,
        subject: subject,
        template: 'member-invitation',
        context: {
          user: user,
          member: member,
          url: url,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  // send otp code for email verification
  async sendOtpCodeToEmail({ name, email, otp }) {
    try {
      const from = `${process.env.APP_NAME} <${appConfig().mail.from}>`;
      const subject = 'Email Verification';

      // add to queue
      await this.queue.add('sendOtpCodeToEmail', {
        to: email,
        from: from,
        subject: subject,
        template: 'email-verification',
        context: {
          name: name,
          otp: otp,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendVerificationLink(params: {
    email: string;
    name: string;
    token: string;
    type: string;
  }) {
    try {
      const verificationLink = `${appConfig().app.url}/api/auth/verify-email?token=${params.token}&email=${params.email}&type=${params.type}`;

      // add to queue
      await this.queue.add('sendVerificationLink', {
        to: params.email,
        subject: 'Verify Your Email',
        template: './verification-link',
        context: {
          name: params.name,
          verificationLink,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendLowBalanceEmail(params: {
    email: string;
    name: string;
    balance: number;
    limit: number;
  }) {
    try {
      // add to queue
      await this.queue.add('sendLowBalanceEmail', {
        to: params.email,
        subject: 'Low Balance Alert',
        template: './low-balance',
        context: {
          name: params.name,
          balance: params.balance,
          limit: params.limit,
          appName: appConfig().app.name,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendCoinPaymentSuccessEmail(params: {
    email: string;
    name: string;
    amount: number;
    sugoId: string;
  }) {
    try {
      console.log('MailService: Adding to queue', params.email);
      // add to queue
      await this.queue.add('sendCoinPaymentSuccessEmail', {
        to: params.email,
        subject:
          'Your Coin Purchase Payment Successful, You will get your coins soon',
        template: './coin-payment-success',
        context: {
          name: params.name,
          amount: params.amount,
          sugoId: params.sugoId,
          appName: appConfig().app.name,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendCoinTransferSuccessEmail(params: {
    email: string;
    name: string;
    amount: number;
    sugoId: string;
  }) {
    try {
      // add to queue
      await this.queue.add('sendCoinTransferSuccessEmail', {
        to: params.email,
        subject: 'Your Coin Transfer Successful',
        template: './coin-transfer-success',
        context: {
          name: params.name,
          amount: params.amount,
          sugoId: params.sugoId,
          appName: appConfig().app.name,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendTicketPurchaseEmail(params: {
    email: string;
    name: string;
    tickets: { title: string; ticket_number: string }[];
  }) {
    try {
      console.log('MailService: Adding to queue', params);
      await this.queue.add('sendTicketPurchaseEmail', {
        to: params.email,
        subject: 'Ticket Purchase Successful',
        template: './ticket-purchase',
        context: {
          name: params.name,
          tickets: params.tickets,
          appName: appConfig().app.name,
        },
      });
      console.log('MailService: Added to queue successfully');
    } catch (error) {
      console.log('MailService Log:', error);
    }
  }

  async sendContactNotificationToAdmin(params: {
    emails: string[];
    name: string;
    email: string;
    subject: string;
    message: string;
    phone_number: string;
  }) {
    try {
      if (!params.emails || params.emails.length === 0) return;

      const to = params.emails[0];
      const cc = params.emails.length > 1 ? params.emails.slice(1) : [];
      0;

      await this.queue.add('sendContactNotificationToAdmin', {
        to: to,
        cc: cc,
        subject: `New Contact Inquiry: ${params.subject}`,
        template: './admin-contact-notification',
        context: {
          name: params.name,
          email: params.email,
          subject: params.subject,
          message: params.message,
          phone_number: params.phone_number || null,
          appName: appConfig().app.name,
        },
      });
    } catch (error) {
      console.log('MailService Log:', error);
    }
  }
}
