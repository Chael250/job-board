import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsService } from './applications.service';
import { 
  ApplicationsController, 
  JobApplicationsController, 
  CompanyApplicationsController 
} from './applications.controller';
import { Application } from './entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Job, User]),
    NotificationsModule,
  ],
  controllers: [
    ApplicationsController,
    JobApplicationsController,
    CompanyApplicationsController,
  ],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}