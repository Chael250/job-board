import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';
import { UsersService } from '../users/users.service';
import { JobsService } from '../jobs/jobs.service';
import { User, UserProfile } from '../users/entities';
import { Job } from '../jobs/entities/job.entity';
import { UserRole } from '../common/types/user-role.enum';

describe('AdminService', () => {
  let service: AdminService;
  let userRepository: Repository<User>;
  let jobRepository: Repository<Job>;
  let usersService: UsersService;
  let jobsService: JobsService;
  let auditLogService: AuditLogService;

  const mockUserRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  };

  const mockJobRepository = {
    count: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  };

  const mockUsersService = {
    searchUsers: jest.fn(),
    findUserById: jest.fn(),
    suspendUser: jest.fn(),
    activateUser: jest.fn(),
    deleteUser: jest.fn(),
    getUserStats: jest.fn(),
    getUsersByRole: jest.fn(),
  };

  const mockJobsService = {
    getAllJobsForAdmin: jest.fn(),
    moderateJob: jest.fn(),
  };

  const mockAuditLogService = {
    logUserAction: jest.fn(),
    getLogs: jest.fn(),
    getSecurityEvents: jest.fn(),
    getUserActivity: jest.fn(),
    getResourceActivity: jest.fn(),
    getActivityStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Job),
          useValue: mockJobRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jobRepository = module.get<Repository<Job>>(getRepositoryToken(Job));
    usersService = module.get<UsersService>(UsersService);
    jobsService = module.get<JobsService>(JobsService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('suspendUser', () => {
    it('should suspend a user and log the action', async () => {
      const userId = 'user-id';
      const adminId = 'admin-id';
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        role: UserRole.JOB_SEEKER,
      } as User;
      const mockSuspendedUser = { ...mockUser, isActive: false };

      mockUsersService.findUserById.mockResolvedValue(mockUser);
      mockUsersService.suspendUser.mockResolvedValue(mockSuspendedUser);

      const result = await service.suspendUser(userId, adminId);

      expect(usersService.findUserById).toHaveBeenCalledWith(userId);
      expect(usersService.suspendUser).toHaveBeenCalledWith(userId);
      expect(auditLogService.logUserAction).toHaveBeenCalled();
      expect(result).toEqual(mockSuspendedUser);
    });

    it('should prevent admin from suspending themselves', async () => {
      const adminId = 'admin-id';
      const mockAdmin = {
        id: adminId,
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      } as User;

      mockUsersService.findUserById.mockResolvedValue(mockAdmin);

      await expect(service.suspendUser(adminId, adminId)).rejects.toThrow(
        'Cannot suspend your own account',
      );
    });

    it('should prevent suspending other admins', async () => {
      const userId = 'user-id';
      const adminId = 'admin-id';
      const mockAdmin = {
        id: userId,
        email: 'other-admin@example.com',
        role: UserRole.ADMIN,
      } as User;

      mockUsersService.findUserById.mockResolvedValue(mockAdmin);

      await expect(service.suspendUser(userId, adminId)).rejects.toThrow(
        'Cannot suspend other admin accounts',
      );
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockStats = {
        total: 100,
        active: 90,
        suspended: 10,
        byRole: {
          [UserRole.ADMIN]: 5,
          [UserRole.COMPANY]: 30,
          [UserRole.JOB_SEEKER]: 65,
        },
      };

      mockUsersService.getUserStats.mockResolvedValue(mockStats);

      const result = await service.getUserStats();

      expect(usersService.getUserStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('getJobStats', () => {
    it('should return job statistics', async () => {
      mockJobRepository.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(40) // active
        .mockResolvedValueOnce(10) // closed
        .mockResolvedValueOnce(20) // full_time
        .mockResolvedValueOnce(15) // part_time
        .mockResolvedValueOnce(10) // contract
        .mockResolvedValueOnce(5); // internship

      const result = await service.getJobStats();

      expect(result).toEqual({
        total: 50,
        active: 40,
        closed: 10,
        byEmploymentType: {
          full_time: 20,
          part_time: 15,
          contract: 10,
          internship: 5,
        },
      });
    });
  });

  describe('moderateJob', () => {
    it('should moderate a job and log the action', async () => {
      const jobId = 'job-id';
      const adminId = 'admin-id';
      const isActive = false;
      const mockJob = {
        id: jobId,
        title: 'Test Job',
        companyId: 'company-id',
        isActive: true,
      } as Job;
      const mockModeratedJob = { ...mockJob, isActive: false };

      mockJobRepository.findOne.mockResolvedValue(mockJob);
      mockJobsService.moderateJob.mockResolvedValue(mockModeratedJob);

      const result = await service.moderateJob(jobId, isActive, adminId);

      expect(jobRepository.findOne).toHaveBeenCalledWith({
        where: { id: jobId },
        relations: ['company', 'company.profile'],
      });
      expect(jobsService.moderateJob).toHaveBeenCalledWith(jobId, isActive);
      expect(auditLogService.logUserAction).toHaveBeenCalled();
      expect(result).toEqual(mockModeratedJob);
    });
  });

  describe('globalSearch', () => {
    it('should search across users and jobs', async () => {
      const query = 'test';
      const pagination = { page: 1, limit: 10 };
      const mockUsers = [{ id: 'user-1', email: 'test@example.com' }] as User[];
      const mockJobs = [{ id: 'job-1', title: 'Test Job' }] as Job[];

      const mockUserQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };

      const mockJobQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockJobs),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockUserQueryBuilder);
      mockJobRepository.createQueryBuilder.mockReturnValue(mockJobQueryBuilder);

      const result = await service.globalSearch(query, pagination);

      expect(result).toEqual({
        users: mockUsers,
        jobs: mockJobs,
        total: 2,
      });
    });
  });
});