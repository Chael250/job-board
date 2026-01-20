import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationService } from '../services/notification.service';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private notificationService: NotificationService) {}

  @Process('send-email')
  async handleSendEmail(job: Job) {
    this.logger.log(`Processing email notification job ${job.id}`);
    
    try {
      await this.notificationService.processEmailNotification(job);
      this.logger.log(`Email notification job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Email notification job ${job.id} failed:`, error.message);
      throw error; // Re-throw to trigger retry mechanism
    }
  }
}