import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/types/user-role.enum';
import { User } from '../users/entities/user.entity';
import { 
  CreateApplicationDto, 
  UpdateApplicationStatusDto, 
  ApplicationFiltersDto 
} from './dto';
import { PaginationDto } from '../common/types/pagination.dto';

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Roles(UserRole.JOB_SEEKER)
  async submitApplication(
    @CurrentUser() user: User,
    @Body() createApplicationDto: CreateApplicationDto,
  ) {
    return this.applicationsService.submitApplication(user.id, createApplicationDto);
  }

  @Get()
  @Roles(UserRole.JOB_SEEKER)
  async getMyApplications(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
  ) {
    return this.applicationsService.getJobSeekerApplications(user.id, pagination);
  }

  @Get(':id')
  async getApplicationById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) applicationId: string,
  ) {
    return this.applicationsService.getApplicationById(applicationId, user.id);
  }

  @Put(':id/status')
  @Roles(UserRole.COMPANY)
  async updateApplicationStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() updateStatusDto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateApplicationStatus(
      applicationId,
      user.id,
      updateStatusDto,
    );
  }
}

@Controller('jobs/:jobId/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @Roles(UserRole.COMPANY)
  async getJobApplications(
    @CurrentUser() user: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query() filters: ApplicationFiltersDto,
    @Query() pagination: PaginationDto,
  ) {
    return this.applicationsService.getJobApplications(jobId, user.id, filters, pagination);
  }
}

@Controller('companies/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanyApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @Roles(UserRole.COMPANY)
  async getCompanyApplications(
    @CurrentUser() user: User,
    @Query() filters: ApplicationFiltersDto,
    @Query() pagination: PaginationDto,
  ) {
    return this.applicationsService.getCompanyApplications(user.id, filters, pagination);
  }
}