import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobFiltersDto } from './dto';
import { PaginationDto } from '../common/types/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/types/user-role.enum';

@Controller('api/v1/admin/jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminJobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async getAllJobs(
    @Query(new ValidationPipe({ transform: true })) filters: JobFiltersDto,
    @Query(new ValidationPipe({ transform: true })) pagination: PaginationDto,
  ) {
    return await this.jobsService.getAllJobsForAdmin(filters, pagination);
  }

  @Put(':id/moderate')
  async moderateJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
  ) {
    const job = await this.jobsService.moderateJob(id, isActive);
    return {
      message: `Job ${isActive ? 'activated' : 'deactivated'} successfully`,
      job,
    };
  }
}