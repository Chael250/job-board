import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Job } from './entities/job.entity';
import { User } from '../users/entities/user.entity';
import { CreateJobDto, UpdateJobDto, JobFiltersDto } from './dto';
import { PaginationDto } from '../common/types/pagination.dto';
import { NotificationService } from '../notifications/services/notification.service';
import { CacheService } from '../common/services/cache.service';
import { QueryOptimizerService } from '../common/services/query-optimizer.service';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private notificationService: NotificationService,
    private cacheService: CacheService,
    private queryOptimizerService: QueryOptimizerService,
  ) {}

  async createJob(companyId: string, createJobDto: CreateJobDto): Promise<Job> {
    // Validate salary range if both min and max are provided
    if (
      createJobDto.salaryMin !== undefined &&
      createJobDto.salaryMax !== undefined &&
      createJobDto.salaryMin > createJobDto.salaryMax
    ) {
      throw new BadRequestException('Salary minimum cannot be greater than maximum');
    }

    // Get company information for notification
    const company = await this.userRepository.findOne({
      where: { id: companyId },
      relations: ['profile'],
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const job = this.jobRepository.create({
      ...createJobDto,
      companyId,
    });

    const savedJob = await this.jobRepository.save(job);

    // Invalidate job listing caches
    await this.invalidateJobCaches();

    // Send job posted notification to company
    try {
      await this.notificationService.sendJobPostedNotification(
        company.email,
        {
          companyName: company.profile?.companyName || 'Your Company',
          jobTitle: savedJob.title,
        },
        companyId, // Pass company userId for preference checking
      );
    } catch (error) {
      // Log notification error but don't fail the job creation
      console.error('Failed to send job posted notification:', error);
    }

    return savedJob;
  }

  async updateJob(
    jobId: string,
    companyId: string,
    updateJobDto: UpdateJobDto,
  ): Promise<Job> {
    const job = await this.findJobById(jobId);

    // Verify ownership
    if (job.companyId !== companyId) {
      throw new ForbiddenException('You can only update your own job listings');
    }

    // Validate salary range if both min and max are provided
    const salaryMin = updateJobDto.salaryMin ?? job.salaryMin;
    const salaryMax = updateJobDto.salaryMax ?? job.salaryMax;
    
    if (
      salaryMin !== undefined &&
      salaryMax !== undefined &&
      salaryMin > salaryMax
    ) {
      throw new BadRequestException('Salary minimum cannot be greater than maximum');
    }

    Object.assign(job, updateJobDto);
    const updatedJob = await this.jobRepository.save(job);

    // Invalidate caches
    await this.invalidateJobCaches();
    await this.cacheService.del(this.cacheService.generateKey('job:detail', jobId));

    return updatedJob;
  }

  async closeJob(jobId: string, companyId: string): Promise<void> {
    const job = await this.findJobById(jobId);

    // Verify ownership
    if (job.companyId !== companyId) {
      throw new ForbiddenException('You can only close your own job listings');
    }

    job.isActive = false;
    job.closedAt = new Date();
    await this.jobRepository.save(job);

    // Invalidate caches
    await this.invalidateJobCaches();
    await this.cacheService.del(this.cacheService.generateKey('job:detail', jobId));
  }

  async getJobs(
    filters: JobFiltersDto,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Job>> {
    const { page = 1, limit = 10 } = pagination;
    
    // Generate cache key based on filters and pagination
    const cacheKey = this.queryOptimizerService.generateCacheKey(
      'Job',
      'getJobs',
      filters,
      { page, limit }
    );

    // Try to get from cache first
    const cachedResult = await this.cacheService.get<PaginatedResponse<Job>>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const queryBuilder = this.createJobQueryBuilder(filters);
    
    // Only return active jobs for public listing
    queryBuilder.andWhere('job.isActive = :isActive', { isActive: true });

    // Use query optimizer for better performance
    const result = await this.queryOptimizerService.optimizePaginatedQuery(
      queryBuilder,
      page,
      limit,
      cacheKey,
      { enableCache: true, cacheTTL: 300 }
    );
    
    return {
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  async getJobById(jobId: string): Promise<Job> {
    // Try cache first
    const cacheKey = this.cacheService.generateKey('job:detail', jobId);
    const cachedJob = await this.cacheService.get<Job>(cacheKey);
    if (cachedJob) {
      return cachedJob;
    }

    const job = await this.jobRepository.findOne({
      where: { id: jobId, isActive: true },
      relations: ['company', 'company.profile'],
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, job, 600);

    return job;
  }

  async getCompanyJobs(
    companyId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Job>> {
    const queryBuilder = this.jobRepository
      .createQueryBuilder('job')
      .where('job.companyId = :companyId', { companyId })
      .orderBy('job.createdAt', 'DESC');

    return await this.executePaginatedQuery(queryBuilder, pagination);
  }

  async getAllJobsForAdmin(
    filters: JobFiltersDto,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Job>> {
    const queryBuilder = this.createJobQueryBuilder(filters);
    
    // Admin can see all jobs (active and inactive)
    return await this.executePaginatedQuery(queryBuilder, pagination);
  }

  async moderateJob(jobId: string, isActive: boolean): Promise<Job> {
    const job = await this.findJobById(jobId);
    
    job.isActive = isActive;
    if (!isActive && !job.closedAt) {
      job.closedAt = new Date();
    }
    
    return await this.jobRepository.save(job);
  }

  private async findJobById(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private createJobQueryBuilder(filters: JobFiltersDto): SelectQueryBuilder<Job> {
    const queryBuilder = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('company.profile', 'profile');

    if (filters.location) {
      queryBuilder.andWhere('LOWER(job.location) LIKE LOWER(:location)', {
        location: `%${filters.location}%`,
      });
    }

    if (filters.employmentType) {
      queryBuilder.andWhere('job.employmentType = :employmentType', {
        employmentType: filters.employmentType,
      });
    }

    if (filters.salaryMin !== undefined) {
      queryBuilder.andWhere(
        '(job.salaryMax IS NULL OR job.salaryMax >= :salaryMin)',
        { salaryMin: filters.salaryMin },
      );
    }

    if (filters.salaryMax !== undefined) {
      queryBuilder.andWhere(
        '(job.salaryMin IS NULL OR job.salaryMin <= :salaryMax)',
        { salaryMax: filters.salaryMax },
      );
    }

    if (filters.keywords) {
      // Use PostgreSQL full-text search for better performance
      queryBuilder.andWhere(
        "to_tsvector('english', job.title || ' ' || job.description) @@ plainto_tsquery('english', :keywords)",
        { keywords: filters.keywords },
      );
    }

    queryBuilder.orderBy('job.createdAt', 'DESC');

    return queryBuilder;
  }

  private async executePaginatedQuery(
    queryBuilder: SelectQueryBuilder<Job>,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Job>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  private async invalidateJobCaches(): Promise<void> {
    // Invalidate all job listing caches
    await this.cacheService.delPattern('jobs:public:*');
    await this.cacheService.delPattern('jobs:company:*');
    await this.cacheService.delPattern('jobs:admin:*');
  }
}