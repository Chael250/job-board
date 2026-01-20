import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/types/user-role.enum';
import { User } from './entities/user.entity';
import { UsersService, PaginatedUsers } from './users.service';
import { UpdateUserDto, UserSearchDto } from './dto';

@Controller('api/v1/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAllUsers(
    @Query(ValidationPipe) searchParams: UserSearchDto,
  ): Promise<PaginatedUsers> {
    return this.usersService.searchUsers(searchParams);
  }

  @Get('stats')
  async getUserStats(): Promise<{
    total: number;
    active: number;
    suspended: number;
    byRole: Record<UserRole, number>;
  }> {
    return this.usersService.getUserStats();
  }

  @Get('role/:role')
  async getUsersByRole(
    @Param('role') role: UserRole,
  ): Promise<User[]> {
    return this.usersService.getUsersByRole(role);
  }

  @Get(':id')
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<User> {
    return this.usersService.findUserById(id);
  }

  @Put(':id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ): Promise<{ message: string; user: User }> {
    const updatedUser = await this.usersService.updateUser(id, updateUserDto);
    return {
      message: 'User updated successfully',
      user: updatedUser,
    };
  }

  @Put(':id/suspend')
  async suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string; user: User }> {
    const suspendedUser = await this.usersService.suspendUser(id);
    return {
      message: 'User suspended successfully',
      user: suspendedUser,
    };
  }

  @Put(':id/activate')
  async activateUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string; user: User }> {
    const activatedUser = await this.usersService.activateUser(id);
    return {
      message: 'User activated successfully',
      user: activatedUser,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.usersService.deleteUser(id);
  }
}