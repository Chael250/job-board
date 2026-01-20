import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { UserRole } from '../../common/types/user-role.enum';
import { IsStrongPassword, IsValidRole, IsSafeHtml } from '../../common/validators';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsStrongPassword()
  password: string;

  @IsValidRole()
  role: UserRole;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  @IsSafeHtml()
  companyDescription?: string;
}