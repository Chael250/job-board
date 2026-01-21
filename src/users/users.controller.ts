import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ValidationPipe,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/types/user-role.enum';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateProfileDto } from './dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async createUser(
    @Body(ValidationPipe) createUserDto: CreateUserDto,
  ): Promise<User> {
    return this.usersService.createUser(createUserDto);
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: User): Promise<User> {
    return this.usersService.findUserById(user.id);
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser() user: User,
    @Body(ValidationPipe) updateProfileDto: UpdateProfileDto,
  ): Promise<{ message: string; profile: any }> {
    const updatedProfile = await this.usersService.updateProfile(user.id, updateProfileDto);
    return {
      message: 'Profile updated successfully',
      profile: updatedProfile,
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<User> {
    return this.usersService.findUserById(id);
  }

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: User): Promise<void> {
    await this.usersService.deleteUser(user.id);
  }
}