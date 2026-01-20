import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { NotificationLog } from '../entities/notification-log.entity';
import { UserNotificationPreferences } from '../entities/user-notification-preferences.entity';
import { NotificationType } from '../interfaces/notification.interface';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockNotificationLogRepository: any;
  let mockUserPreferencesRepository: any;
  let mockQueue: any;
  let mockEmailService: any;

  beforeEach(async () => {
    mockNotificationLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      })),
    };

    mockUserPreferencesRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockQueue = {
      add: jest.fn(),
    };

    mockEmailService = {
      sendEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(NotificationLog),
          useValue: mockNotificationLogRepository,
        },
        {
          provide: getRepositoryToken(UserNotificationPreferences),
          useValue: mockUserPreferencesRepository,
        },
        {
          provide: getQueueToken('notifications'),
          useValue: mockQueue,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendNotification', () => {
    it('should queue notification when user preferences allow', async () => {
      const mockLog = { id: 'log-id' };
      mockNotificationLogRepository.create.mockReturnValue(mockLog);
      mockNotificationLogRepository.save.mockResolvedValue(mockLog);
      mockUserPreferencesRepository.findOne.mockResolvedValue({
        emailNotifications: true,
        applicationStatusChanges: true,
      });

      await service.sendNotification(
        NotificationType.APPLICATION_STATUS_CHANGE,
        'test@example.com',
        { test: 'data' },
        1,
        'user-id',
      );

      expect(mockNotificationLogRepository.create).toHaveBeenCalled();
      expect(mockNotificationLogRepository.save).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        {
          logId: 'log-id',
          to: 'test@example.com',
          template: NotificationType.APPLICATION_STATUS_CHANGE,
          data: { test: 'data' },
        },
        expect.objectContaining({
          priority: 1,
          attempts: 3,
        }),
      );
    });

    it('should skip notification when user has disabled email notifications', async () => {
      mockUserPreferencesRepository.findOne.mockResolvedValue({
        emailNotifications: false,
        applicationStatusChanges: true,
      });

      await service.sendNotification(
        NotificationType.APPLICATION_STATUS_CHANGE,
        'test@example.com',
        { test: 'data' },
        1,
        'user-id',
      );

      expect(mockNotificationLogRepository.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('getUserNotificationPreferences', () => {
    it('should return existing preferences', async () => {
      const mockPreferences = {
        userId: 'user-id',
        emailNotifications: true,
        applicationStatusChanges: true,
      };
      mockUserPreferencesRepository.findOne.mockResolvedValue(mockPreferences);

      const result = await service.getUserNotificationPreferences('user-id');

      expect(result).toEqual(mockPreferences);
      expect(mockUserPreferencesRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });

    it('should create default preferences if none exist', async () => {
      const mockDefaultPreferences = {
        userId: 'user-id',
        applicationStatusChanges: true,
        newApplications: true,
        jobPosted: true,
        accountSuspended: true,
        emailNotifications: true,
      };

      mockUserPreferencesRepository.findOne.mockResolvedValue(null);
      mockUserPreferencesRepository.create.mockReturnValue(mockDefaultPreferences);
      mockUserPreferencesRepository.save.mockResolvedValue(mockDefaultPreferences);

      const result = await service.getUserNotificationPreferences('user-id');

      expect(mockUserPreferencesRepository.create).toHaveBeenCalledWith(mockDefaultPreferences);
      expect(mockUserPreferencesRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockDefaultPreferences);
    });
  });
});