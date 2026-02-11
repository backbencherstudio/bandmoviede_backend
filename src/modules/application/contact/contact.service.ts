import { Injectable } from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto';
import { PrismaService } from '../../../prisma/prisma.service';

import { MailService } from 'src/mail/mail.service';

@Injectable()
export class ContactService {
  constructor(
    private prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async create(createContactDto: CreateContactDto) {
    try {
      const data = {};
      if (createContactDto.name) {
        data['name'] = createContactDto.name;
      }
      if (createContactDto.subject) {
        data['subject'] = createContactDto.subject;
      }
      if (createContactDto.email) {
        data['email'] = createContactDto.email;
      }
      if (createContactDto.phone_number) {
        data['phone_number'] = createContactDto.phone_number;
      }
      if (createContactDto.message) {
        data['message'] = createContactDto.message;
      }

      await this.prisma.contact.create({
        data: data,
      });

      // Fetch all admin users
      const admins = await this.prisma.user.findMany({
        where: { type: 'admin' },
        select: { email: true },
      });

      const adminEmails = admins
        .map((admin) => admin.email)
        .filter((email) => email);

      if (adminEmails.length > 0) {
        await this.mailService.sendContactNotificationToAdmin({
          emails: adminEmails,
          name: createContactDto.name,
          email: createContactDto.email,
          subject: createContactDto.subject,
          message: createContactDto.message,
          phone_number: createContactDto.phone_number,
        });
      }

      return {
        success: true,
        message: 'Submitted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
