import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './services/notification.service';
import { EmailService } from './services/email.service';
import { NotificationProcessor } from './processors/notification.processor';
import { NotificationPreferencesController } from './controllers/notification-preferences.controller';
import { NotificationLog, UserNotificationPreferences } from './entities';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([NotificationLog, UserNotificationPreferences]),
    BullModule.registerQueue({
      name: 'notifications',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0,
      },
    }),
  ],
  controllers: [NotificationPreferencesController],
  providers: [NotificationService, EmailService, NotificationProcessor],
  exports: [NotificationService],
})
export class NotificationsModule {}