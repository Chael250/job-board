import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '../entities/application.entity';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus, { message: 'Invalid application status' })
  status: ApplicationStatus;
}