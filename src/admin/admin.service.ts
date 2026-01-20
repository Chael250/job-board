import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserProfile } from '../users/entities';
import { Job } from '../jobs/entities/job.entity';
import { UserRole } from '../common/types/user-role.enum';
import { UsersService, PaginatedUsers } from '../users/users.service';
import { JobsService, PaginatedResponse } from '../jobs/jobs.service';
import { AuditLogService, AuditLogFilters, PaginatedAuditLogs } from './audit-log.service';
import { AuditAction, ResourceType } from './entities/audit-log.entity';
import { UserSearchDto } from '../users/dto';
import { JobFiltersDto } from '../jobs/dto';
import { PaginationDto } from '../common/types/pagination.dto';

export interface AdminUserStats {
  total: number;
  active: number;
  suspended: number;
  byRole: Record<UserRole, number>;
}

export interface AdminJobStats {
  total: number;
  active: number;
  closed: number;
  byEmploymentType: Record<string, number>;
}

export interface AdminDashboardStats {
  users: AdminUserStats;
  jobs: AdminJobStats;
  recentActivity: {
    newUsersToday: number;
    newJobsToday: number;
    applicationsToday: number;
  };
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly usersService: UsersService,
    private readonly jobsService: JobsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // User Management Methods
  async searchUsers(searchParams: UserSearchDto): Promise<PaginatedUsers> {
    return this.usersService.searchUsers(searchParams);
  }

  async getUserById(id: string): Promise<User> {
    return this.usersService.findUserById(id);
  }

  async suspendUser(id: string, adminId: string, request?: any): Promise<User> {
    const user = await this.usersService.findUserById(id);
    
    // Prevent admin from suspending themselves
    if (user.id === adminId) {
      throw new BadRequestException('Cannot suspend your own account');
    }

    // Prevent suspending other admins (business rule)
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot suspend other admin accounts');
    }

    const result = await this.usersService.suspendUser(id);

    // Log the admin action
    await this.auditLogService.logUserAction(
      adminId,
      AuditAction.USER_SUSPENDED,
      ResourceType.USER,
      id,
      { 
        targetUserEmail: user.email,
        targetUserRole: user.role,
        reason: 'Admin suspension'
      },
      request,
    );

    return result;
  }

  async activateUser(id: string, adminId: string, request?: any): Promise<User> {
    const user = await this.usersService.findUserById(id);
    const result = await this.usersService.activateUser(id);

    // Log the admin action
    await this.auditLogService.logUserAction(
      adminId,
      AuditAction.USER_ACTIVATED,
      ResourceType.USER,
      id,
      { 
        targetUserEmail: user.email,
        targetUserRole: user.role,
        reason: 'Admin activation'
      },
      request,
    );

    return result;
  }

  async deleteUser(id: string, adminId: string, request?: any): Promise<void> {
    const user = await this.usersService.findUserById(id);
    
    // Prevent admin from deleting themselves
    if (user.id === adminId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    // Prevent deleting other admins (business rule)
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot delete other admin accounts');
    }

    await this.usersService.deleteUser(id);

    // Log the admin action
    await this.auditLogService.logUserAction(
      adminId,
      AuditAction.USER_DELETED,
      ResourceType.USER,
      id,
      { 
        targetUserEmail: user.email,
        targetUserRole: user.role,
        reason: 'Admin deletion'
      },
      request,
    );
  }

  async getUserStats(): Promise<AdminUserStats> {
    return this.usersService.getUserStats();
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return this.usersService.getUsersByRole(role);
  }

  // Job Management Methods
  async getAllJobs(
    filters: JobFiltersDto,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Job>> {
    return this.jobsService.getAllJobsForAdmin(filters, pagination);
  }

  async getJobById(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ['company', 'company.profile'],
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async moderateJob(jobId: string, isActive: boolean, adminId: string, request?: any): Promise<Job> {
    const job = await this.getJobById(jobId);
    const result = await this.jobsService.moderateJob(jobId, isActive);

    // Log the admin action
    await this.auditLogService.logUserAction(
      adminId,
      AuditAction.JOB_MODERATED,
      ResourceType.JOB,
      jobId,
      { 
        jobTitle: job.title,
        companyId: job.companyId,
        previousStatus: job.isActive,
        newStatus: isActive,
        reason: 'Admin moderation'
      },
      request,
    );

    return result;
  }

  async deleteJob(jobId: string, adminId: string, request?: any): Promise<void> {
    const job = await this.getJobById(jobId);
    await this.jobRepository.remove(job);

    // Log the admin action
    await this.auditLogService.logUserAction(
      adminId,
      AuditAction.JOB_DELETED,
      ResourceType.JOB,
      jobId,
      { 
        jobTitle: job.title,
        companyId: job.companyId,
        reason: 'Admin deletion'
      },
      request,
    );
  }

  async getJobStats(): Promise<AdminJobStats> {
    const total = await this.jobRepository.count();
    const active = await this.jobRepository.count({ where: { isActive: true } });
    const closed = await this.jobRepository.count({ where: { isActive: false } });

    // Get stats by employment type
    const employmentTypes = ['full_time', 'part_time', 'contract', 'internship'];
    const byEmploymentType: Record<string, number> = {};
    
    for (const type of employmentTypes) {
      byEmploymentType[type] = await this.jobRepository.count({
        where: { employmentType: type as any },
      });
    }

    return {
      total,
      active,
      closed,
      byEmploymentType,
    };
  }

  // Audit Log Methods
  async getAuditLogs(
    filters: AuditLogFilters,
    pagination: PaginationDto,
  ): Promise<PaginatedAuditLogs> {
    return this.auditLogService.getLogs(filters, pagination);
  }

  async getSecurityEvents(
    pagination: PaginationDto,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PaginatedAuditLogs> {
    return this.auditLogService.getSecurityEvents(pagination, startDate, endDate);
  }

  async getUserActivity(
    userId: string,
    pagination: PaginationDto,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PaginatedAuditLogs> {
    return this.auditLogService.getUserActivity(userId, pagination, startDate, endDate);
  }

  async getResourceActivity(
    resourceType: ResourceType,
    resourceId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedAuditLogs> {
    return this.auditLogService.getResourceActivity(resourceType, resourceId, pagination);
  }

  async getActivityStats(startDate?: Date, endDate?: Date) {
    return this.auditLogService.getActivityStats(startDate, endDate);
  }

  // Dashboard and Analytics
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const userStats = await this.getUserStats();
    const jobStats = await this.getJobStats();

    // Get today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const newUsersToday = await this.userRepository.count({
      where: {
        createdAt: {
          $gte: today,
          $lt: tomorrow,
        } as any,
      },
    });

    const newJobsToday = await this.jobRepository.count({
      where: {
        createdAt: {
          $gte: today,
          $lt: tomorrow,
        } as any,
      },
    });

    // Note: Applications count would require Application entity
    // For now, we'll set it to 0 as a placeholder
    const applicationsToday = 0;

    return {
      users: userStats,
      jobs: jobStats,
      recentActivity: {
        newUsersToday,
        newJobsToday,
        applicationsToday,
      },
    };
  }

  // Search across all entities
  async globalSearch(query: string, pagination: PaginationDto): Promise<{
    users: User[];
    jobs: Job[];
    total: number;
  }> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Search users
    const userQueryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .where(
        '(LOWER(user.email) LIKE LOWER(:query) OR ' +
        'LOWER(profile.firstName) LIKE LOWER(:query) OR ' +
        'LOWER(profile.lastName) LIKE LOWER(:query) OR ' +
        'LOWER(profile.companyName) LIKE LOWER(:query))',
        { query: `%${query}%` }
      )
      .take(Math.ceil(limit / 2));

    // Search jobs
    const jobQueryBuilder = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('company.profile', 'profile')
      .where(
        '(LOWER(job.title) LIKE LOWER(:query) OR ' +
        'LOWER(job.description) LIKE LOWER(:query) OR ' +
        'LOWER(profile.companyName) LIKE LOWER(:query))',
        { query: `%${query}%` }
      )
      .take(Math.ceil(limit / 2));

    const [users, jobs] = await Promise.all([
      userQueryBuilder.getMany(),
      jobQueryBuilder.getMany(),
    ]);

    return {
      users,
      jobs,
      total: users.length + jobs.length,
    };
  }
}