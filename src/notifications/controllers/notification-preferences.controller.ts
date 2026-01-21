import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { NotificationService } from '../services/notification.service';
import { UserNotificationPreferences } from '../entities/user-notification-preferences.entity';

export class UpdateNotificationPreferencesDto {
  applicationStatusChanges?: boolean;
  newApplications?: boolean;
  jobPosted?: boolean;
  accountSuspended?: boolean;
  emailNotifications?: boolean;
}

@Controller('notifications/preferences')
@UseGuards(JwtAuthGuard)
export class NotificationPreferencesController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  async getPreferences(
    @CurrentUser() user: any,
  ): Promise<UserNotificationPreferences> {
    return this.notificationService.getUserNotificationPreferences(user.id);
  }

  @Put()
  async updatePreferences(
    @CurrentUser() user: any,
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ): Promise<UserNotificationPreferences> {
    return this.notificationService.updateUserNotificationPreferences(
      user.id,
      updateDto,
    );
  }
}