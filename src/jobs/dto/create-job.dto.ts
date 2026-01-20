import { IsString, IsOptional, Length } from 'class-validator';
import { EmploymentType } from '../entities/job.entity';
import { IsValidEmploymentType, IsPositiveNumber, IsSafeHtml } from '../../common/validators';

export class CreateJobDto {
  @IsString()
  @Length(5, 255)
  title: string;

  @IsString()
  @Length(50, 5000)
  @IsSafeHtml()
  description: string;

  @IsString()
  @IsOptional()
  @Length(0, 5000)
  @IsSafeHtml()
  requirements?: string;

  @IsString()
  @Length(2, 255)
  location: string;

  @IsValidEmploymentType()
  employmentType: EmploymentType;

  @IsOptional()
  @IsPositiveNumber()
  salaryMin?: number;

  @IsOptional()
  @IsPositiveNumber()
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  salaryCurrency?: string = 'USD';
}