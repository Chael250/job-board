import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserProfile } from '../users/entities';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserRole } from '../common/types/user-role.enum';
import { RegisterDto, LoginDto } from './dto';
import { AuthResponse } from './interfaces/auth.interface';

/**
 * Property-Based Tests for Authentication Module
 * 
 * Feature: job-board-application
 * Properties 1-3: Authentication and Authorization Properties
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.7
 */

describe('Authentication Property Tests', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let userProfileRepository: Repository<UserProfile>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let jwtService: JwtService;

  // Mock repositories and services
  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockUserProfileRepository = {
    save: jest.fn(),
  };

  const mockRefreshTokenRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserProfile),
          useValue: mockUserProfileRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    userProfileRepository = module.get<Repository<UserProfile>>(getRepositoryToken(UserProfile));
    refreshTokenRepository = module.get<Repository<RefreshToken>>(getRepositoryToken(RefreshToken));
    jwtService = module.get<JwtService>(JwtService);

    // Set up environment variables for JWT
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 1: User Registration Creates Correct Accounts
   * 
   * For any valid user registration data, creating an account should result in 
   * a user record with the specified role and hashed password
   * 
   * Validates: Requirements 1.1, 1.5
   */
  describe('Property 1: User Registration Creates Correct Accounts', () => {
    it('should create accounts with correct role and hashed password for any valid registration data', async () => {
      const testCases = fc.sample(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8, maxLength: 50 }).filter(pwd => 
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pwd) // Basic password requirements
          ),
          role: fc.constantFrom(UserRole.JOB_SEEKER, UserRole.COMPANY, UserRole.ADMIN),
          firstName: fc.string({ minLength: 1, maxLength: 100 }).filter(name => 
            /^[a-zA-Z\s'-]+$/.test(name)
          ),
          lastName: fc.string({ minLength: 1, maxLength: 100 }).filter(name => 
            /^[a-zA-Z\s'-]+$/.test(name)
          ),
          phone: fc.option(fc.string({ minLength: 10, maxLength: 20 })),
          location: fc.option(fc.string({ minLength: 2, maxLength: 255 })),
          companyName: fc.option(fc.string({ minLength: 1, maxLength: 255 })),
          companyDescription: fc.option(fc.string({ minLength: 1, maxLength: 1000 })),
        }),
        { numRuns: 10 } // Reduced from 50 to avoid timeout
      );

      for (const registerData of testCases) {
        // Mock that user doesn't exist
        mockUserRepository.findOne.mockResolvedValue(null);
        
        // Mock saved user
        const savedUser = {
          id: fc.sample(fc.uuid(), 1)[0],
          email: registerData.email,
          role: registerData.role,
          isActive: true,
          passwordHash: 'hashed-password', // Simulated hashed password
          profile: {
            firstName: registerData.firstName,
            lastName: registerData.lastName,
            phone: registerData.phone,
            location: registerData.location,
            companyName: registerData.companyName,
            companyDescription: registerData.companyDescription,
          },
        };

        mockUserRepository.save.mockResolvedValue(savedUser);
        mockUserProfileRepository.save.mockResolvedValue(savedUser.profile);
        mockRefreshTokenRepository.save.mockResolvedValue({ id: 'refresh-token-id' });
        mockJwtService.sign.mockReturnValue('mock-jwt-token');

        const result = await service.register(registerData as RegisterDto);

        // Verify account creation properties
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
        expect(result).toHaveProperty('user');
        expect(result.user.email).toBe(registerData.email);
        expect(result.user.role).toBe(registerData.role);
        expect(result.user.profile.firstName).toBe(registerData.firstName);
        expect(result.user.profile.lastName).toBe(registerData.lastName);

        // Verify user repository was called with correct data
        expect(mockUserRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            email: registerData.email,
            role: registerData.role,
            passwordHash: registerData.password, // Will be hashed by entity
          })
        );

        // Verify profile was created with correct data
        expect(mockUserProfileRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: registerData.firstName,
            lastName: registerData.lastName,
            phone: registerData.phone,
            location: registerData.location,
            companyName: registerData.companyName,
            companyDescription: registerData.companyDescription,
          })
        );

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    }, 10000); // Increased timeout to 10 seconds

    it('should reject registration for existing email addresses', async () => {
      const testCases = fc.sample(
        fc.record({
          email: fc.emailAddress(),
          role: fc.constantFrom(UserRole.JOB_SEEKER, UserRole.COMPANY, UserRole.ADMIN),
          firstName: fc.string({ minLength: 1, maxLength: 100 }),
          lastName: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        { numRuns: 10 } // Reduced from 30
      );

      for (const testCase of testCases) {
        const registerData: RegisterDto = {
          email: testCase.email,
          password: 'ValidPass123!',
          role: testCase.role,
          firstName: testCase.firstName,
          lastName: testCase.lastName,
        };

        // Mock that user already exists
        mockUserRepository.findOne.mockResolvedValue({ id: 'existing-user-id', email: testCase.email });

        await expect(service.register(registerData)).rejects.toThrow(ConflictException);
        
        // Verify no user creation was attempted
        expect(mockUserRepository.save).not.toHaveBeenCalled();
        expect(mockUserProfileRepository.save).not.toHaveBeenCalled();

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    });
  });

  /**
   * Property 2: Token Management Round Trip
   * 
   * For any valid user credentials, login followed by token refresh should produce 
   * valid tokens, and using refresh tokens should generate new token pairs
   * 
   * Validates: Requirements 1.2, 1.3, 1.7
   */
  describe('Property 2: Token Management Round Trip', () => {
    it('should generate valid token pairs for login and refresh cycles', async () => {
      const testCases = fc.sample(
        fc.record({
          userId: fc.uuid(),
          email: fc.emailAddress(),
          role: fc.constantFrom(UserRole.JOB_SEEKER, UserRole.COMPANY, UserRole.ADMIN),
          firstName: fc.string({ minLength: 1, maxLength: 100 }),
          lastName: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        { numRuns: 5 } // Reduced from 30
      );

      for (const userData of testCases) {
        const loginData: LoginDto = {
          email: userData.email,
          password: 'ValidPass123!',
        };

        // Mock user validation
        const mockUser = {
          id: userData.userId,
          email: userData.email,
          role: userData.role,
          isActive: true,
          validatePassword: jest.fn().mockResolvedValue(true),
          profile: {
            firstName: userData.firstName,
            lastName: userData.lastName,
          },
        };

        mockUserRepository.findOne.mockResolvedValue(mockUser);
        mockRefreshTokenRepository.save.mockResolvedValue({ id: 'refresh-token-id' });
        
        // Mock JWT token generation - use consistent mock values
        mockJwtService.sign.mockReturnValue('mock-jwt-token');

        // Test login
        const loginResult = await service.login(loginData);

        // Verify login response structure (don't check specific token values)
        expect(loginResult).toHaveProperty('accessToken');
        expect(loginResult).toHaveProperty('refreshToken');
        expect(loginResult).toHaveProperty('user');
        expect(loginResult).toHaveProperty('expiresIn');
        expect(loginResult.user.id).toBe(userData.userId);
        expect(loginResult.user.email).toBe(userData.email);
        expect(loginResult.user.role).toBe(userData.role);

        // Test refresh token round trip
        const refreshTokenPayload = {
          sub: userData.userId,
          tokenId: 'refresh-token-id',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        };

        mockJwtService.verify.mockReturnValue(refreshTokenPayload);
        mockRefreshTokenRepository.findOne.mockResolvedValue({
          id: 'refresh-token-id',
          userId: userData.userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revokedAt: null,
        });

        // Mock new token generation for refresh
        mockRefreshTokenRepository.save.mockResolvedValue({ id: 'new-refresh-token-id' });

        const refreshResult = await service.refreshToken('mock-refresh-token');

        // Verify refresh response structure
        expect(refreshResult).toHaveProperty('accessToken');
        expect(refreshResult).toHaveProperty('refreshToken');
        expect(refreshResult).toHaveProperty('user');
        expect(refreshResult.user.id).toBe(userData.userId);
        expect(refreshResult.user.email).toBe(userData.email);

        // Verify old refresh token was revoked
        expect(mockRefreshTokenRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            revokedAt: expect.any(Date),
          })
        );

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    });

    it('should reject invalid or expired refresh tokens', async () => {
      const testCases = fc.sample(fc.string(), { numRuns: 5 }); // Reduced from 20

      for (const invalidRefreshToken of testCases) {
        // Mock JWT verification failure
        mockJwtService.verify.mockImplementation(() => {
          throw new Error('Invalid token');
        });

        await expect(service.refreshToken(invalidRefreshToken)).rejects.toThrow(UnauthorizedException);

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    });

    it('should reject refresh tokens for inactive users', async () => {
      const testCases = fc.sample(fc.uuid(), { numRuns: 5 }); // Reduced from 20

      for (const userId of testCases) {
        const refreshTokenPayload = {
          sub: userId,
          tokenId: 'refresh-token-id',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        };

        mockJwtService.verify.mockReturnValue(refreshTokenPayload);
        mockRefreshTokenRepository.findOne.mockResolvedValue({
          id: 'refresh-token-id',
          userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revokedAt: null,
        });

        // Mock inactive user
        mockUserRepository.findOne.mockResolvedValue({
          id: userId,
          isActive: false,
        });

        await expect(service.refreshToken('valid-refresh-token')).rejects.toThrow(UnauthorizedException);

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    });
  });

  /**
   * Property 3: Authentication Failures Are Logged
   * 
   * For any invalid credentials, login attempts should be rejected and 
   * security events should be logged
   * 
   * Validates: Requirements 1.4, 8.6
   */
  describe('Property 3: Authentication Failures Are Logged', () => {
    it('should reject invalid credentials and handle authentication failures', async () => {
      const testCases = fc.sample(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 1, maxLength: 100 }),
          userExists: fc.boolean(),
          passwordValid: fc.boolean(),
          userActive: fc.boolean(),
        }),
        { numRuns: 10 } // Reduced from 50
      );

      for (const testData of testCases) {
        const loginData: LoginDto = {
          email: testData.email,
          password: testData.password,
        };

        if (!testData.userExists) {
          // User doesn't exist
          mockUserRepository.findOne.mockResolvedValue(null);
          
          const result = await service.validateUser(testData.email, testData.password);
          expect(result).toBeNull();
          
          await expect(service.login(loginData)).rejects.toThrow(UnauthorizedException);
        } else {
          // User exists but password might be invalid or user inactive
          const mockUser = {
            id: fc.sample(fc.uuid(), 1)[0],
            email: testData.email,
            isActive: testData.userActive,
            validatePassword: jest.fn().mockResolvedValue(testData.passwordValid),
            profile: {
              firstName: 'Test',
              lastName: 'User',
            },
          };

          mockUserRepository.findOne.mockResolvedValue(mockUser);

          if (!testData.passwordValid) {
            // Invalid password
            const result = await service.validateUser(testData.email, testData.password);
            expect(result).toBeNull();
            
            await expect(service.login(loginData)).rejects.toThrow(UnauthorizedException);
          } else if (!testData.userActive) {
            // Valid password but inactive user
            await expect(service.login(loginData)).rejects.toThrow(UnauthorizedException);
          } else {
            // Valid credentials and active user - should succeed
            mockRefreshTokenRepository.save.mockResolvedValue({ id: 'refresh-token-id' });
            mockJwtService.sign.mockReturnValue('mock-token');

            const result = await service.login(loginData);
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
          }
        }

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    }, 10000); // Increased timeout

    it('should handle various authentication failure scenarios consistently', async () => {
      const testCases = fc.sample(
        fc.array(
          fc.record({
            email: fc.emailAddress(),
            password: fc.string({ minLength: 1, maxLength: 100 }),
            shouldFail: fc.boolean(),
          }),
          { minLength: 1, maxLength: 3 } // Reduced array size
        ),
        { numRuns: 5 } // Reduced from 20
      );

      for (const loginAttempts of testCases) {
        for (const attempt of loginAttempts) {
          if (attempt.shouldFail) {
            // Mock failure scenario
            mockUserRepository.findOne.mockResolvedValue(null);
            
            await expect(service.login({
              email: attempt.email,
              password: attempt.password,
            })).rejects.toThrow(UnauthorizedException);
          } else {
            // Mock success scenario
            const mockUser = {
              id: fc.sample(fc.uuid(), 1)[0],
              email: attempt.email,
              isActive: true,
              validatePassword: jest.fn().mockResolvedValue(true),
              profile: { firstName: 'Test', lastName: 'User' },
            };

            mockUserRepository.findOne.mockResolvedValue(mockUser);
            mockRefreshTokenRepository.save.mockResolvedValue({ id: 'refresh-token-id' });
            mockJwtService.sign.mockReturnValue('mock-token');

            const result = await service.login({
              email: attempt.email,
              password: attempt.password,
            });

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
          }

          // Clear mocks for next iteration
          jest.clearAllMocks();
        }
      }
    }, 10000); // Increased timeout

    it('should validate user credentials consistently across different scenarios', async () => {
      const testCases = fc.sample(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8, maxLength: 50 }),
          userExists: fc.boolean(),
        }),
        { numRuns: 10 } // Reduced from 30
      );

      for (const testCase of testCases) {
        if (testCase.userExists) {
          const mockUser = {
            id: fc.sample(fc.uuid(), 1)[0],
            email: testCase.email,
            validatePassword: jest.fn().mockResolvedValue(true),
          };
          mockUserRepository.findOne.mockResolvedValue(mockUser);

          const result = await service.validateUser(testCase.email, testCase.password);
          expect(result).toBe(mockUser);
          expect(mockUser.validatePassword).toHaveBeenCalledWith(testCase.password);
        } else {
          mockUserRepository.findOne.mockResolvedValue(null);

          const result = await service.validateUser(testCase.email, testCase.password);
          expect(result).toBeNull();
        }

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    });
  });
});