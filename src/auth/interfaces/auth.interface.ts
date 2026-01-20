import { UserRole } from '../../common/types/user-role.enum';

export interface JWTPayload {
  sub: string;        // User ID
  email: string;      // User email
  role: UserRole;     // ADMIN | COMPANY | JOB_SEEKER
  iat: number;        // Issued at
  exp: number;        // Expires at
}

export interface RefreshTokenPayload {
  sub: string;        // User ID
  tokenId: string;    // Unique token identifier
  iat: number;        // Issued at
  exp: number;        // Expires at
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    profile: {
      firstName: string;
      lastName: string;
      phone?: string;
      location?: string;
      companyName?: string;
      companyDescription?: string;
    };
  };
  expiresIn: number;
}