import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { EmailTemplate } from '../interfaces/notification.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpConfig = {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<number>('SMTP_PORT') === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    };

    // Skip auth if no credentials provided (for development)
    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
      delete smtpConfig.auth;
    }

    this.transporter = nodemailer.createTransport(smtpConfig);
    
    this.logger.log('Email transporter initialized');
  }

  async sendEmail(
    to: string,
    template: EmailTemplate,
    data: Record<string, any> = {},
  ): Promise<boolean> {
    try {
      const subject = this.replaceTemplateVariables(template.subject, data);
      const html = this.replaceTemplateVariables(template.html, data);
      const text = this.replaceTemplateVariables(template.text, data);

      const mailOptions = {
        from: this.configService.get<string>('SMTP_FROM'),
        to,
        subject,
        html,
        text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(`Email sent successfully to ${to}. MessageId: ${result.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error.message);
      throw error;
    }
  }

  private replaceTemplateVariables(template: string, data: Record<string, any>): string {
    let result = template;
    
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(data[key] || ''));
    });
    
    return result;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection verification failed:', error.message);
      return false;
    }
  }
}