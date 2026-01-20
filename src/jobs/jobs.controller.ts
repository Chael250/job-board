import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto, UpdateJobDto, JobFiltersDto } from './dto';
import { PaginationDto } from '../common/types/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/types/user-role.enum';

@Controller('api/v1/jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // Public endpoints - no authentication required
  @Public()
  @Get()
  async getJobs(
    @Query(new ValidationPipe({ transform: true })) filters: JobFiltersDto,
    @Query(new ValidationPipe({ transform: true })) pagination: PaginationDto,
  ) {
    return await this.jobsService.getJobs(filters, pagination);
  }

  @Public()
  @Get(':id')
  async getJobById(@Param('id', ParseUUIDPipe) id: string) {
    return await this.jobsService.getJobById(id);
  }

  // Company endpoints - require company role
  @Post()
  @Roles(UserRole.COMPANY)
  async createJob(
    @CurrentUser() user: User,
    @Body(ValidationPipe) createJobDto: CreateJobDto,
  ) {
    return await this.jobsService.createJob(user.id, createJobDto);
  }

  @Put(':id')
  @Roles(UserRole.COMPANY)
  async updateJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body(ValidationPipe) updateJobDto: UpdateJobDto,
  ) {
    return await this.jobsService.updateJob(id, user.id, updateJobDto);
  }

  @Delete(':id')
  @Roles(UserRole.COMPANY)
  async closeJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.jobsService.closeJob(id, user.id);
    return { message: 'Job closed successfully' };
  }

  @Get('company/my-jobs')
  @Roles(UserRole.COMPANY)
  async getMyJobs(
    @CurrentUser() user: User,
    @Query(new ValidationPipe({ transform: true })) pagination: PaginationDto,
  ) {
    return await this.jobsService.getCompanyJobs(user.id, pagination);
  }
}