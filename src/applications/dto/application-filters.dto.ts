import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApplicationStatus } from '../entities/application.entity';

export class ApplicationFiltersDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsUUID()
  jobSeekerId?: string;
}