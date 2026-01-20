import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { User, UserProfile } from './entities';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto, UserSearchDto } from './dto';
import { UserRole } from '../common/types/user-role.enum';

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,
  ) {}

  async createUser(createUserData: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserData.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create user
    const user = new User();
    user.email = createUserData.email;
    user.passwordHash = createUserData.password; // Will be hashed by entity hook
    user.role = createUserData.role;

    const savedUser = await this.userRepository.save(user);

    // Create user profile
    const profile = new UserProfile();
    profile.userId = savedUser.id;
    profile.firstName = createUserData.firstName;
    profile.lastName = createUserData.lastName;
    profile.phone = createUserData.phone;
    profile.location = createUserData.location;
    profile.companyName = createUserData.companyName;
    profile.companyDescription = createUserData.companyDescription;

    const savedProfile = await this.userProfileRepository.save(profile);
    savedUser.profile = savedProfile;

    return savedUser;
  }

  async findUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['profile'],
    });
  }

  async updateUser(id: string, updateData: UpdateUserDto): Promise<User> {
    const user = await this.findUserById(id);

    if (updateData.password) {
      user.passwordHash = updateData.password; // Will be hashed by entity hook
    }

    if (updateData.isActive !== undefined) {
      user.isActive = updateData.isActive;
    }

    return this.userRepository.save(user);
  }

  async updateProfile(userId: string, updateData: UpdateProfileDto): Promise<UserProfile> {
    const user = await this.findUserById(userId);
    
    if (!user.profile) {
      throw new NotFoundException('User profile not found');
    }

    // Update profile fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        user.profile[key] = updateData[key];
      }
    });

    return this.userProfileRepository.save(user.profile);
  }

  async suspendUser(id: string): Promise<User> {
    return this.updateUser(id, { isActive: false });
  }

  async activateUser(id: string): Promise<User> {
    return this.updateUser(id, { isActive: true });
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findUserById(id);
    await this.userRepository.remove(user);
  }

  async searchUsers(searchParams: UserSearchDto): Promise<PaginatedUsers> {
    const { page = 1, limit = 10, search, role, isActive, location } = searchParams;
    
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .orderBy('user.createdAt', 'DESC');

    // Apply filters
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(user.email) LIKE LOWER(:search) OR ' +
        'LOWER(profile.firstName) LIKE LOWER(:search) OR ' +
        'LOWER(profile.lastName) LIKE LOWER(:search) OR ' +
        'LOWER(profile.companyName) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }

    if (location) {
      queryBuilder.andWhere('LOWER(profile.location) LIKE LOWER(:location)', {
        location: `%${location}%`
      });
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return this.userRepository.find({
      where: { role },
      relations: ['profile'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    suspended: number;
    byRole: Record<UserRole, number>;
  }> {
    const total = await this.userRepository.count();
    const active = await this.userRepository.count({ where: { isActive: true } });
    const suspended = await this.userRepository.count({ where: { isActive: false } });

    const byRole = {} as Record<UserRole, number>;
    for (const role of Object.values(UserRole)) {
      byRole[role] = await this.userRepository.count({ where: { role } });
    }

    return {
      total,
      active,
      suspended,
      byRole,
    };
  }
}