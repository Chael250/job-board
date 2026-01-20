import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserProfile } from './entities';
import { UserRole } from '../common/types/user-role.enum';
import { CreateUserDto } from './dto';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Repository<User>;
  let userProfileRepository: Repository<UserProfile>;

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserProfileRepository = {
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserProfile),
          useValue: mockUserProfileRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    userProfileRepository = module.get<Repository<UserProfile>>(getRepositoryToken(UserProfile));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      password: 'Password123!',
      role: UserRole.JOB_SEEKER,
      firstName: 'John',
      lastName: 'Doe',
      phone: '1234567890',
      location: 'New York',
    };

    it('should create a new user successfully', async () => {
      const savedUser = {
        id: '123',
        email: createUserDto.email,
        role: createUserDto.role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedProfile = {
        id: '456',
        userId: '123',
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        phone: createUserDto.phone,
        location: createUserDto.location,
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(savedUser);
      mockUserProfileRepository.save.mockResolvedValue(savedProfile);

      const result = await service.createUser(createUserDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockUserProfileRepository.save).toHaveBeenCalled();
      expect(result.profile).toEqual(savedProfile);
    });

    it('should throw ConflictException if user already exists', async () => {
      const existingUser = { id: '123', email: createUserDto.email };
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      await expect(service.createUser(createUserDto)).rejects.toThrow(ConflictException);
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findUserById', () => {
    it('should return user if found', async () => {
      const user = {
        id: '123',
        email: 'test@example.com',
        profile: { firstName: 'John', lastName: 'Doe' },
      };

      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await service.findUserById('123');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
        relations: ['profile'],
      });
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findUserById('123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('suspendUser', () => {
    it('should suspend user successfully', async () => {
      const user = {
        id: '123',
        email: 'test@example.com',
        isActive: true,
        profile: { firstName: 'John', lastName: 'Doe' },
      };

      const suspendedUser = { ...user, isActive: false };

      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(suspendedUser);

      const result = await service.suspendUser('123');

      expect(result.isActive).toBe(false);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });
});