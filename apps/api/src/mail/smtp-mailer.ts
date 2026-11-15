import { Inject, Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV, type Env } from '../config/env';
import { Mailer, type MailMessage } from './mailer';

@Injectable()
export class SmtpMailer extends Mailer {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(@Inject(ENV) env: Env) {
    super();
    this.from = env.MAIL_FROM;
    this.transport = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' }
        : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
