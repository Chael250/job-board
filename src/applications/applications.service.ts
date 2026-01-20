import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application, ApplicationStatus } from './entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { CreateApplicationDto, UpdateApplicationStatusDto, ApplicationFiltersDto } from './dto';
import { PaginationDto } from '../common/types/pagination.dto';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private applicationRepository: Repository<Application>,
    @InjectRepository(Job)
    private jobRepository: Repository<Job>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async submitApplication(
    jobSeekerId: string,
    createApplicationDto: CreateApplicationDto,
  ): Promise<Application> {
    const { jobId, coverLetter, resumeUrl } = createApplicationDto;

    // Check if job exists and is active
    const job = await this.jobRepository.findOne({
      where: { id: jobId, isActive: true },
    });

    if (!job) {
      throw new NotFoundException('Job not found or is no longer active');
    }

    // Check if user exists and is a job seeker
    const jobSeeker = await this.userRepository.findOne({
      where: { id: jobSeekerId },
    });

    if (!jobSeeker) {
      throw new NotFoundException('Job seeker not found');
    }

    // Check for duplicate application
    const existingApplication = await this.applicationRepository.findOne({
      where: { jobId, jobSeekerId },
    });

    if (existingApplication) {
      throw new ConflictException('You have already applied for this job');
    }

    // Create new application
    const application = this.applicationRepository.create({
      jobId,
      jobSeekerId,
      coverLetter,
      resumeUrl,
      status: ApplicationStatus.APPLIED,
    });

    return this.applicationRepository.save(application);
  }

  async updateApplicationStatus(
    applicationId: string,
    companyId: string,
    updateStatusDto: UpdateApplicationStatusDto,
  ): Promise<Application> {
    const { status } = updateStatusDto;

    // Find application with job relationship
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify company owns the job
    if (application.job.companyId !== companyId) {
      throw new ForbiddenException('You can only update applications for your own jobs');
    }

    // Validate status transition
    this.validateStatusTransition(application.status, status);

    // Update application
    application.status = status;
    application.reviewedAt = new Date();
    application.reviewedBy = companyId;

    return this.applicationRepository.save(application);
  }

  async getJobSeekerApplications(
    jobSeekerId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Application>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [applications, total] = await this.applicationRepository.findAndCount({
      where: { jobSeekerId },
      relations: ['job', 'job.company'],
      order: { appliedAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: applications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getJobApplications(
    jobId: string,
    companyId: string,
    filters: ApplicationFiltersDto,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Application>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Verify company owns the job
    const job = await this.jobRepository.findOne({
      where: { id: jobId, companyId },
    });

    if (!job) {
      throw new ForbiddenException('You can only view applications for your own jobs');
    }

    // Build query conditions
    const whereConditions: any = { jobId };
    if (filters.status) {
      whereConditions.status = filters.status;
    }

    const [applications, total] = await this.applicationRepository.findAndCount({
      where: whereConditions,
      relations: ['jobSeeker', 'jobSeeker.profile'],
      order: { appliedAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: applications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCompanyApplications(
    companyId: string,
    filters: ApplicationFiltersDto,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Application>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Build query to get applications for company's jobs
    const queryBuilder = this.applicationRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.job', 'job')
      .leftJoinAndSelect('application.jobSeeker', 'jobSeeker')
      .leftJoinAndSelect('jobSeeker.profile', 'profile')
      .where('job.companyId = :companyId', { companyId });

    if (filters.status) {
      queryBuilder.andWhere('application.status = :status', { status: filters.status });
    }

    if (filters.jobId) {
      queryBuilder.andWhere('application.jobId = :jobId', { jobId: filters.jobId });
    }

    queryBuilder
      .orderBy('application.appliedAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [applications, total] = await queryBuilder.getManyAndCount();

    return {
      data: applications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async checkExistingApplication(jobId: string, jobSeekerId: string): Promise<boolean> {
    const application = await this.applicationRepository.findOne({
      where: { jobId, jobSeekerId },
    });
    return !!application;
  }

  async getApplicationById(applicationId: string, userId: string): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['job', 'jobSeeker', 'jobSeeker.profile'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Check if user has permission to view this application
    const canView = 
      application.jobSeekerId === userId || // Job seeker can view their own application
      application.job.companyId === userId; // Company can view applications for their jobs

    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this application');
    }

    return application;
  }

  private validateStatusTransition(currentStatus: ApplicationStatus, newStatus: ApplicationStatus): void {
    const validTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
      [ApplicationStatus.APPLIED]: [ApplicationStatus.REVIEWED, ApplicationStatus.REJECTED],
      [ApplicationStatus.REVIEWED]: [ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED],
      [ApplicationStatus.SHORTLISTED]: [ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED],
      [ApplicationStatus.ACCEPTED]: [], // Terminal state
      [ApplicationStatus.REJECTED]: [], // Terminal state
    };

    const allowedTransitions = validTransitions[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}