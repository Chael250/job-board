import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AuditAction {
  // User Management Actions
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_SUSPENDED = 'user_suspended',
  USER_ACTIVATED = 'user_activated',
  USER_DELETED = 'user_deleted',
  
  // Job Management Actions
  JOB_CREATED = 'job_created',
  JOB_UPDATED = 'job_updated',
  JOB_CLOSED = 'job_closed',
  JOB_MODERATED = 'job_moderated',
  JOB_DELETED = 'job_deleted',
  
  // Application Actions
  APPLICATION_CREATED = 'application_created',
  APPLICATION_STATUS_UPDATED = 'application_status_updated',
  
  // Security Events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_CHANGED = 'password_changed',
  TOKEN_REFRESHED = 'token_refreshed',
  LOGOUT = 'logout',
  
  // Admin Actions
  ADMIN_ACCESS = 'admin_access',
  BULK_OPERATION = 'bulk_operation',
  
  // File Operations
  FILE_UPLOADED = 'file_uploaded',
  FILE_DOWNLOADED = 'file_downloaded',
  FILE_DELETED = 'file_deleted',
}

export enum ResourceType {
  USER = 'user',
  JOB = 'job',
  APPLICATION = 'application',
  FILE = 'file',
  SYSTEM = 'system',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({
    name: 'resource_type',
    type: 'enum',
    enum: ResourceType,
  })
  resourceType: ResourceType;

  @Column({ name: 'resource_id', nullable: true })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any>;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  endpoint: string;

  @Column({ name: 'http_method', nullable: true })
  httpMethod: string;

  @Column({ name: 'status_code', nullable: true })
  statusCode: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}