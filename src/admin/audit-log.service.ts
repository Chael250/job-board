import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { AuditLog, AuditAction, ResourceType } from './entities/audit-log.entity';
import { PaginationDto } from '../common/types/pagination.dto';

export interface AuditLogEntry {
  userId?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  httpMethod?: string;
  statusCode?: number;
}

export interface AuditLogFilters {
  userId?: string;
  action?: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
}

export interface PaginatedAuditLogs {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async createLog(logEntry: AuditLogEntry): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      ...logEntry,
      createdAt: new Date(),
    });

    return this.auditLogRepository.save(auditLog);
  }

  async createLogAsync(logEntry: AuditLogEntry): Promise<void> {
    // Fire and forget - don't wait for the log to be saved
    // This prevents audit logging from affecting application performance
    setImmediate(async () => {
      try {
        await this.createLog(logEntry);
      } catch (error) {
        // Log to console if audit logging fails, but don't throw
        console.error('Failed to create audit log:', error);
      }
    });
  }

  async getLogs(
    filters: AuditLogFilters,
    pagination: PaginationDto,
  ): Promise<PaginatedAuditLogs> {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit_log')
      .leftJoinAndSelect('audit_log.user', 'user')
      .leftJoinAndSelect('user.profile', 'profile')
      .orderBy('audit_log.createdAt', 'DESC');

    // Apply filters
    if (filters.userId) {
      queryBuilder.andWhere('audit_log.userId = :userId', { userId: filters.userId });
    }

    if (filters.action) {
      queryBuilder.andWhere('audit_log.action = :action', { action: filters.action });
    }

    if (filters.resourceType) {
      queryBuilder.andWhere('audit_log.resourceType = :resourceType', {
        resourceType: filters.resourceType,
      });
    }

    if (filters.resourceId) {
      queryBuilder.andWhere('audit_log.resourceId = :resourceId', {
        resourceId: filters.resourceId,
      });
    }

    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('audit_log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters.startDate) {
      queryBuilder.andWhere('audit_log.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    } else if (filters.endDate) {
      queryBuilder.andWhere('audit_log.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    if (filters.ipAddress) {
      queryBuilder.andWhere('audit_log.ipAddress = :ipAddress', {
        ipAddress: filters.ipAddress,
      });
    }

    const [logs, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLogById(id: string): Promise<AuditLog | null> {
    return this.auditLogRepository.findOne({
      where: { id },
      relations: ['user', 'user.profile'],
    });
  }

  async getSecurityEvents(
    pagination: PaginationDto,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PaginatedAuditLogs> {
    const securityActions = [
      AuditAction.LOGIN_FAILED,
      AuditAction.PASSWORD_CHANGED,
      AuditAction.USER_SUSPENDED,
      AuditAction.USER_DELETED,
      AuditAction.ADMIN_ACCESS,
    ];

    const filters: AuditLogFilters = {
      startDate,
      endDate,
    };

    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit_log')
      .leftJoinAndSelect('audit_log.user', 'user')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('audit_log.action IN (:...actions)', { actions: securityActions })
      .orderBy('audit_log.createdAt', 'DESC');

    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('audit_log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    const [logs, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserActivity(
    userId: string,
    pagination: PaginationDto,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PaginatedAuditLogs> {
    const filters: AuditLogFilters = {
      userId,
      startDate,
      endDate,
    };

    return this.getLogs(filters, pagination);
  }

  async getResourceActivity(
    resourceType: ResourceType,
    resourceId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedAuditLogs> {
    const filters: AuditLogFilters = {
      resourceType,
      resourceId,
    };

    return this.getLogs(filters, pagination);
  }

  async getActivityStats(startDate?: Date, endDate?: Date): Promise<{
    totalEvents: number;
    securityEvents: number;
    userActions: number;
    adminActions: number;
    byAction: Record<AuditAction, number>;
    byResourceType: Record<ResourceType, number>;
  }> {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log');

    if (startDate && endDate) {
      queryBuilder.where('audit_log.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const totalEvents = await queryBuilder.getCount();

    // Security events count
    const securityActions = [
      AuditAction.LOGIN_FAILED,
      AuditAction.PASSWORD_CHANGED,
      AuditAction.USER_SUSPENDED,
      AuditAction.USER_DELETED,
    ];

    const securityEventsQuery = queryBuilder.clone();
    securityEventsQuery.andWhere('audit_log.action IN (:...actions)', {
      actions: securityActions,
    });
    const securityEvents = await securityEventsQuery.getCount();

    // Admin actions count
    const adminActionsQuery = queryBuilder.clone();
    adminActionsQuery.andWhere('audit_log.action = :action', {
      action: AuditAction.ADMIN_ACCESS,
    });
    const adminActions = await adminActionsQuery.getCount();

    const userActions = totalEvents - adminActions;

    // Get counts by action and resource type
    const byAction = {} as Record<AuditAction, number>;
    const byResourceType = {} as Record<ResourceType, number>;

    for (const action of Object.values(AuditAction)) {
      const actionQuery = queryBuilder.clone();
      actionQuery.andWhere('audit_log.action = :action', { action });
      byAction[action] = await actionQuery.getCount();
    }

    for (const resourceType of Object.values(ResourceType)) {
      const resourceQuery = queryBuilder.clone();
      resourceQuery.andWhere('audit_log.resourceType = :resourceType', { resourceType });
      byResourceType[resourceType] = await resourceQuery.getCount();
    }

    return {
      totalEvents,
      securityEvents,
      userActions,
      adminActions,
      byAction,
      byResourceType,
    };
  }

  // Utility methods for common logging scenarios
  async logUserAction(
    userId: string,
    action: AuditAction,
    resourceType: ResourceType,
    resourceId?: string,
    details?: Record<string, any>,
    request?: { ip?: string; userAgent?: string; url?: string; method?: string },
  ): Promise<void> {
    await this.createLogAsync({
      userId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      endpoint: request?.url,
      httpMethod: request?.method,
    });
  }

  async logSecurityEvent(
    action: AuditAction,
    details: Record<string, any>,
    request?: { ip?: string; userAgent?: string; url?: string; method?: string },
    userId?: string,
  ): Promise<void> {
    await this.createLogAsync({
      userId,
      action,
      resourceType: ResourceType.SYSTEM,
      details,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      endpoint: request?.url,
      httpMethod: request?.method,
    });
  }
}