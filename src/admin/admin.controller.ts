import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Req,
  ParseBoolPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/types/user-role.enum';
import { User } from '../users/entities/user.entity';
import { Job } from '../jobs/entities/job.entity';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';
import { AuditAction, ResourceType } from './entities/audit-log.entity';
import { UserSearchDto } from '../users/dto';
import { JobFiltersDto } from '../jobs/dto';
import { AuditLogFiltersDto } from './dto';
import { PaginationDto } from '../common/types/pagination.dto';

interface ConfirmationDto {
  confirmed: boolean;
  reason?: string;
}

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // Dashboard and Stats
  @Get('dashboard')
  async getDashboard(@CurrentUser() admin: User, @Req() request: Request) {
    // Log admin access
    await this.auditLogService.logUserAction(
      admin.id,
      AuditAction.ADMIN_ACCESS,
      ResourceType.SYSTEM,
      undefined,
      { action: 'dashboard_access' },
      {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url,
        method: request.method,
      },
    );

    return this.adminService.getDashboardStats();
  }

  @Get('stats/users')
  async getUserStats() {
    return this.adminService.getUserStats();
  }

  @Get('stats/jobs')
  async getJobStats() {
    return this.adminService.getJobStats();
  }

  @Get('stats/activity')
  async getActivityStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.adminService.getActivityStats(start, end);
  }

  // User Management
  @Get('users')
  async getAllUsers(@Query(ValidationPipe) searchParams: UserSearchDto) {
    return this.adminService.searchUsers(searchParams);
  }

  @Get('users/role/:role')
  async getUsersByRole(@Param('role') role: UserRole) {
    return this.adminService.getUsersByRole(role);
  }

  @Get('users/:id')
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserById(id);
  }

  @Put('users/:id/suspend')
  async suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() confirmationDto: ConfirmationDto,
    @CurrentUser() admin: User,
    @Req() request: Request,
  ) {
    if (!confirmationDto.confirmed) {
      return {
        error: 'Confirmation required',
        message: 'This action requires confirmation. Set confirmed: true to proceed.',
        requiresConfirmation: true,
      };
    }

    const suspendedUser = await this.adminService.suspendUser(
      id,
      admin.id,
      {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url,
        method: request.method,
      },
    );

    return {
      message: 'User suspended successfully',
      user: suspendedUser,
      reason: confirmationDto.reason,
    };
  }

  @Put('users/:id/activate')
  async activateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: User,
    @Req() request: Request,
  ) {
    const activatedUser = await this.adminService.activateUser(
      id,
      admin.id,
      {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url,
        method: request.method,
      },
    );

    return {
      message: 'User activated successfully',
      user: activatedUser,
    };
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() confirmationDto: ConfirmationDto,
    @CurrentUser() admin: User,
    @Req() request: Request,
  ) {
    if (!confirmationDto.confirmed) {
      return {
        error: 'Confirmation required',
        message: 'This action requires confirmation. Set confirmed: true to proceed.',
        requiresConfirmation: true,
      };
    }

    await this.adminService.deleteUser(
      id,
      admin.id,
      {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url,
        method: request.method,
      },
    );

    return {
      message: 'User deleted successfully',
      reason: confirmationDto.reason,
    };
  }

  // Job Management
  @Get('jobs')
  async getAllJobs(
    @Query(ValidationPipe) filters: JobFiltersDto,
    @Query(ValidationPipe) pagination: PaginationDto,
  ) {
    return this.adminService.getAllJobs(filters, pagination);
  }

  @Get('jobs/:id')
  async getJobById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getJobById(id);
  }

  @Put('jobs/:id/moderate')
  async moderateJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @Body() body: { reason?: string },
    @CurrentUser() admin: User,
    @Req() request: Request,
  ) {
    const moderatedJob = await this.adminService.moderateJob(
      id,
      isActive,
      admin.id,
      {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url,
        method: request.method,
      },
    );

    return {
      message: `Job ${isActive ? 'activated' : 'deactivated'} successfully`,
      job: moderatedJob,
      reason: body.reason,
    };
  }

  @Delete('jobs/:id')
  @HttpCode(HttpStatus.OK)
  async deleteJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() confirmationDto: ConfirmationDto,
    @CurrentUser() admin: User,
    @Req() request: Request,
  ) {
    if (!confirmationDto.confirmed) {
      return {
        error: 'Confirmation required',
        message: 'This action requires confirmation. Set confirmed: true to proceed.',
        requiresConfirmation: true,
      };
    }

    await this.adminService.deleteJob(
      id,
      admin.id,
      {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url,
        method: request.method,
      },
    );

    return {
      message: 'Job deleted successfully',
      reason: confirmationDto.reason,
    };
  }

  // Audit Logs
  @Get('audit-logs')
  async getAuditLogs(
    @Query(ValidationPipe) filters: AuditLogFiltersDto,
    @Query(ValidationPipe) pagination: PaginationDto,
    @CurrentUser() admin: User,
    @Req() request: Request,
  ) {
    // Log audit log access
    await this.auditLogService.logUserAction(
      admin.id,
      AuditAction.ADMIN_ACCESS,
      ResourceType.SYSTEM,
      undefined,
      { action: 'audit_logs_access', filters },
      {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url,
        method: request.method,
      },
    );

    return this.adminService.getAuditLogs(filters, pagination);
  }

  @Get('audit-logs/security')
  async getSecurityEvents(
    @Query(ValidationPipe) pagination: PaginationDto,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.adminService.getSecurityEvents(pagination, start, end);
  }

  @Get('audit-logs/user/:userId')
  async getUserActivity(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query(ValidationPipe) pagination: PaginationDto,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.adminService.getUserActivity(userId, pagination, start, end);
  }

  @Get('audit-logs/resource/:resourceType/:resourceId')
  async getResourceActivity(
    @Param('resourceType') resourceType: ResourceType,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Query(ValidationPipe) pagination: PaginationDto,
  ) {
    return this.adminService.getResourceActivity(resourceType, resourceId, pagination);
  }

  // Global Search
  @Get('search')
  async globalSearch(
    @Query('q') query: string,
    @Query(ValidationPipe) pagination: PaginationDto,
    @CurrentUser() admin: User,
    @Req() request: Request,
  ) {
    if (!query || query.trim().length < 2) {
      return {
        error: 'Query too short',
        message: 'Search query must be at least 2 characters long',
      };
    }

    // Log search activity
    await this.auditLogService.logUserAction(
      admin.id,
      AuditAction.ADMIN_ACCESS,
      ResourceType.SYSTEM,
      undefined,
      { action: 'global_search', query },
      {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url,
        method: request.method,
      },
    );

    return this.adminService.globalSearch(query, pagination);
  }

  // Bulk Operations
  @Put('users/bulk/suspend')
  async bulkSuspendUsers(
    @Body() body: { userIds: string[]; confirmed: boolean; reason?: string },
    @CurrentUser() admin: User,
    @Req() request: Request,
  ) {
    if (!body.confirmed) {
      return {
        error: 'Confirmation required',
        message: 'This bulk action requires confirmation. Set confirmed: true to proceed.',
        requiresConfirmation: true,
        affectedCount: body.userIds.length,
      };
    }

    const results = [];
    const errors = [];

    for (const userId of body.userIds) {
      try {
        const user = await this.adminService.suspendUser(
          userId,
          admin.id,
          {
            ip: request.ip,
            userAgent: request.get('User-Agent'),
            url: request.url,
            method: request.method,
          },
        );
        results.push({ userId, success: true, user });
      } catch (error) {
        errors.push({ userId, success: false, error: error.message });
      }
    }

    // Log bulk operation
    await this.auditLogService.logUserAction(
      admin.id,
      AuditAction.BULK_OPERATION,
      ResourceType.USER,
      undefined,
      {
        action: 'bulk_suspend_users',
        userIds: body.userIds,
        successCount: results.length,
        errorCount: errors.length,
        reason: body.reason,
      },
      {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url,
        method: request.method,
      },
    );

    return {
      message: 'Bulk suspension completed',
      results,
      errors,
      summary: {
        total: body.userIds.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  }

  @Put('jobs/bulk/moderate')
  async bulkModerateJobs(
    @Body() body: { jobIds: string[]; isActive: boolean; reason?: string },
    @CurrentUser() admin: User,
    @Req() request: Request,
  ) {
    const results = [];
    const errors = [];

    for (const jobId of body.jobIds) {
      try {
        const job = await this.adminService.moderateJob(
          jobId,
          body.isActive,
          admin.id,
          {
            ip: request.ip,
            userAgent: request.get('User-Agent'),
            url: request.url,
            method: request.method,
          },
        );
        results.push({ jobId, success: true, job });
      } catch (error) {
        errors.push({ jobId, success: false, error: error.message });
      }
    }

    // Log bulk operation
    await this.auditLogService.logUserAction(
      admin.id,
      AuditAction.BULK_OPERATION,
      ResourceType.JOB,
      undefined,
      {
        action: 'bulk_moderate_jobs',
        jobIds: body.jobIds,
        isActive: body.isActive,
        successCount: results.length,
        errorCount: errors.length,
        reason: body.reason,
      },
      {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        url: request.url,
        method: request.method,
      },
    );

    return {
      message: `Bulk job ${body.isActive ? 'activation' : 'deactivation'} completed`,
      results,
      errors,
      summary: {
        total: body.jobIds.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  }
}