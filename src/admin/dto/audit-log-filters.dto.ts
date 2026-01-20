import { IsOptional, IsEnum, IsUUID, IsDateString, IsIP } from 'class-validator';
import { Transform } from 'class-transformer';
import { AuditAction, ResourceType } from '../entities/audit-log.entity';

export class AuditLogFiltersDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsEnum(ResourceType)
  resourceType?: ResourceType;

  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  endDate?: Date;

  @IsOptional()
  @IsIP()
  ipAddress?: string;
}