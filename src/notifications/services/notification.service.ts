import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { EmailService } from './email.service';
import { NotificationLog } from '../entities/notification-log.entity';
import { UserNotificationPreferences } from '../entities/user-notification-preferences.entity';
import { NotificationData, NotificationType } from '../interfaces/notification.interface';
import { EMAIL_TEMPLATES } from '../templates/email-templates';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue('notifications') private notificationQueue: Queue,
    @InjectRepository(NotificationLog)
    private notificationLogRepository: Repository<NotificationLog>,
    @InjectRepository(UserNotificationPreferences)
    private userPreferencesRepository: Repository<UserNotificationPreferences>,
    private emailService: EmailService,
  ) {}

  async sendNotification(
    type: NotificationType,
    to: string,
    data: Record<string, any>,
    priority: number = 0,
    userId?: string,
  ): Promise<void> {
    try {
      // Check user preferences if userId is provided
      if (userId) {
        const preferences = await this.getUserNotificationPreferences(userId);
        if (!this.shouldSendNotification(type, preferences)) {
          this.logger.log(`Notification skipped due to user preferences: ${type} for user ${userId}`);
          return;
        }
      }

      // Create notification log entry
      const notificationLog = this.notificationLogRepository.create({
        to,
        template: type,
        data,
        status: 'pending',
      });
      
      const savedLog = await this.notificationLogRepository.save(notificationLog);

      // Add job to queue with retry configuration
      await this.notificationQueue.add(
        'send-email',
        {
          logId: savedLog.id,
          to,
          template: type,
          data,
        },
        {
          priority,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2 seconds
          },
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      );

      this.logger.log(`Notification queued for ${to} with template ${type}`);
    } catch (error) {
      this.logger.error(`Failed to queue notification for ${to}:`, error.message);
      throw error;
    }
  }

  async processEmailNotification(job: any): Promise<void> {
    const { logId, to, template, data } = job.data;
    
    try {
      // Update log status to retrying
      await this.updateNotificationLog(logId, {
        status: 'retrying',
        attempts: job.attemptsMade + 1,
        lastAttempt: new Date(),
      });

      // Get email template
      const emailTemplate = EMAIL_TEMPLATES[template];
      if (!emailTemplate) {
        throw new Error(`Email template not found: ${template}`);
      }

      // Send email
      await this.emailService.sendEmail(to, emailTemplate, data);

      // Update log status to sent
      await this.updateNotificationLog(logId, {
        status: 'sent',
        sentAt: new Date(),
        error: null,
      });

      this.logger.log(`Email notification sent successfully to ${to}`);
    } catch (error) {
      // Update log status to failed
      await this.updateNotificationLog(logId, {
        status: 'failed',
        error: error.message,
      });

      this.logger.error(`Failed to send email notification to ${to}:`, error.message);
      throw error;
    }
  }

  private async updateNotificationLog(
    logId: string,
    updates: Partial<NotificationLog>,
  ): Promise<void> {
    try {
      await this.notificationLogRepository.update(logId, updates);
    } catch (error) {
      this.logger.error(`Failed to update notification log ${logId}:`, error.message);
    }
  }

  async getNotificationLogs(
    filters: {
      to?: string;
      template?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ logs: NotificationLog[]; total: number }> {
    const queryBuilder = this.notificationLogRepository.createQueryBuilder('log');

    if (filters.to) {
      queryBuilder.andWhere('log.to = :to', { to: filters.to });
    }

    if (filters.template) {
      queryBuilder.andWhere('log.template = :template', { template: filters.template });
    }

    if (filters.status) {
      queryBuilder.andWhere('log.status = :status', { status: filters.status });
    }

    queryBuilder.orderBy('log.createdAt', 'DESC');

    if (filters.limit) {
      queryBuilder.limit(filters.limit);
    }

    if (filters.offset) {
      queryBuilder.offset(filters.offset);
    }

    const [logs, total] = await queryBuilder.getManyAndCount();

    return { logs, total };
  }

  async retryFailedNotification(logId: string): Promise<void> {
    const log = await this.notificationLogRepository.findOne({
      where: { id: logId },
    });

    if (!log) {
      throw new Error(`Notification log not found: ${logId}`);
    }

    if (log.status !== 'failed') {
      throw new Error(`Cannot retry notification with status: ${log.status}`);
    }

    // Re-queue the notification
    await this.notificationQueue.add(
      'send-email',
      {
        logId: log.id,
        to: log.to,
        template: log.template,
        data: log.data,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    // Update log status
    await this.updateNotificationLog(logId, {
      status: 'pending',
    });

    this.logger.log(`Notification ${logId} re-queued for retry`);
  }

  // Convenience methods for specific notification types
  async sendApplicationStatusChangeNotification(
    jobSeekerEmail: string,
    data: {
      jobSeekerName: string;
      jobTitle: string;
      companyName: string;
      status: string;
      applicationDate: string;
    },
    userId?: string,
  ): Promise<void> {
    await this.sendNotification(
      NotificationType.APPLICATION_STATUS_CHANGE,
      jobSeekerEmail,
      data,
      1, // High priority
      userId,
    );
  }

  async sendNewApplicationNotification(
    companyEmail: string,
    data: {
      companyName: string;
      jobTitle: string;
      applicantName: string;
      applicationDate: string;
      resumeAttached: boolean;
    },
    userId?: string,
  ): Promise<void> {
    await this.sendNotification(
      NotificationType.NEW_APPLICATION,
      companyEmail,
      data,
      1, // High priority
      userId,
    );
  }

  async sendJobPostedNotification(
    companyEmail: string,
    data: {
      companyName: string;
      jobTitle: string;
    },
    userId?: string,
  ): Promise<void> {
    await this.sendNotification(
      NotificationType.JOB_POSTED,
      companyEmail,
      data,
      0, // Normal priority
      userId,
    );
  }

  async sendAccountSuspendedNotification(
    userEmail: string,
    data: {
      userName: string;
      reason: string;
    },
    userId?: string,
  ): Promise<void> {
    await this.sendNotification(
      NotificationType.ACCOUNT_SUSPENDED,
      userEmail,
      data,
      2, // Highest priority
      userId,
    );
  }

  // User preference management
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
    let preferences = await this.userPreferencesRepository.findOne({
      where: { userId },
    });

    if (!preferences) {
      // Create default preferences if none exist
      preferences = this.userPreferencesRepository.create({
        userId,
        applicationStatusChanges: true,
        newApplications: true,
        jobPosted: true,
        accountSuspended: true,
        emailNotifications: true,
      });
      preferences = await this.userPreferencesRepository.save(preferences);
    }

    return preferences;
  }

  async updateUserNotificationPreferences(
    userId: string,
    updates: Partial<UserNotificationPreferences>,
  ): Promise<UserNotificationPreferences> {
    let preferences = await this.getUserNotificationPreferences(userId);
    
    Object.assign(preferences, updates);
    return await this.userPreferencesRepository.save(preferences);
  }

  private shouldSendNotification(
    type: NotificationType,
    preferences: UserNotificationPreferences,
  ): boolean {
    if (!preferences.emailNotifications) {
      return false;
    }

    switch (type) {
      case NotificationType.APPLICATION_STATUS_CHANGE:
        return preferences.applicationStatusChanges;
      case NotificationType.NEW_APPLICATION:
        return preferences.newApplications;
      case NotificationType.JOB_POSTED:
        return preferences.jobPosted;
      case NotificationType.ACCOUNT_SUSPENDED:
        return preferences.accountSuspended;
      default:
        return true;
    }
  }
}