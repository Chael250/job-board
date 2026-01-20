import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Track by IP address and user ID if available
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.user?.id;
    return userId ? `${ip}-${userId}` : ip;
  }
}