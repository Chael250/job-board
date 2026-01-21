import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserProfile } from '../users/entities';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto, LoginDto } from './dto';
import { AuthResponse, JWTPayload, RefreshTokenPayload } from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerData: RegisterDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerData.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create user
    const user = new User();
    user.email = registerData.email;
    user.passwordHash = registerData.password; // Will be hashed by entity hook
    user.role = registerData.role;

    const savedUser = await this.userRepository.save(user);

    // Create user profile
    const profile = new UserProfile();
    profile.userId = savedUser.id;
    profile.firstName = registerData.firstName;
    profile.lastName = registerData.lastName;
    profile.phone = registerData.phone;
    profile.location = registerData.location;
    profile.companyName = registerData.companyName;
    profile.companyDescription = registerData.companyDescription;

    const savedProfile = await this.userProfileRepository.save(profile);
    savedUser.profile = savedProfile;

    // Generate tokens
    return this.generateTokens(savedUser);
  }

  async login(loginData: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(loginData.email, loginData.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended');
    }

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      }) as RefreshTokenPayload;

      // Check if refresh token exists and is not revoked
      const tokenRecord = await this.refreshTokenRepository.findOne({
        where: {
          id: payload.tokenId,
          userId: payload.sub,
          revokedAt: null,
        },
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['profile'],
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Revoke old refresh token
      tokenRecord.revokedAt = new Date();
      await this.refreshTokenRepository.save(tokenRecord);

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, tokenId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { id: tokenId, userId },
      { revokedAt: new Date() }
    );
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['profile'],
    });

    if (user && await user.validatePassword(password)) {
      return user;
    }

    return null;
  }

  private async generateTokens(user: User): Promise<AuthResponse> {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
    };

    // Generate refresh token
    const refreshTokenId = await this.createRefreshToken(user.id);
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenId: refreshTokenId,
      iat: Math.floor(Date.now() / 1000),
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: {
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          phone: user.profile.phone,
          location: user.profile.location,
          companyName: user.profile.companyName,
          companyDescription: user.profile.companyDescription,
        },
      },
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const refreshToken = new RefreshToken();
    refreshToken.userId = userId;
    refreshToken.tokenHash = await bcrypt.hash(`${userId}-${Date.now()}`, 10);
    refreshToken.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const saved = await this.refreshTokenRepository.save(refreshToken);
    return saved.id;
  }
}