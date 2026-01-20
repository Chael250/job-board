import { IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(100, { message: 'First name must not exceed 100 characters' })
  @Matches(/^[a-zA-Z\s\-']+$/, { message: 'First name can only contain letters, spaces, hyphens, and apostrophes' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(100, { message: 'Last name must not exceed 100 characters' })
  @Matches(/^[a-zA-Z\s\-']+$/, { message: 'Last name can only contain letters, spaces, hyphens, and apostrophes' })
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Location must be at least 2 characters' })
  @MaxLength(255, { message: 'Location must not exceed 255 characters' })
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Resume URL must not exceed 500 characters' })
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Company name must not exceed 255 characters' })
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Company description must not exceed 5000 characters' })
  companyDescription?: string;
}