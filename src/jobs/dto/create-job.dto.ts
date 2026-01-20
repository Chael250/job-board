import { IsString, IsEnum, IsOptional, IsInt, Min, Max, Length } from 'class-validator';
import { EmploymentType } from '../entities/job.entity';

export class CreateJobDto {
  @IsString()
  @Length(5, 255)
  title: string;

  @IsString()
  @Length(50, 5000)
  description: string;

  @IsString()
  @IsOptional()
  @Length(0, 5000)
  requirements?: string;

  @IsString()
  @Length(2, 255)
  location: string;

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  salaryCurrency?: string = 'USD';
}