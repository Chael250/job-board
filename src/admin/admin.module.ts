import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';
import { AdminController } from './admin.controller';
import { User, UserProfile } from '../users/entities';
import { Job } from '../jobs/entities/job.entity';
import { AuditLog } from './entities/audit-log.entity';
import { UsersModule } from '../users/users.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, Job, AuditLog]),
    UsersModule,
    JobsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AuditLogService],
  exports: [AdminService, AuditLogService],
})
export class AdminModule {}