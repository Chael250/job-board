import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApplicationDto {
  @IsUUID()
  jobId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Cover letter must not exceed 2000 characters' })
  coverLetter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Resume URL must not exceed 500 characters' })
  resumeUrl?: string;
}