import { ConfigService } from '@nestjs/config';
import { BullModuleOptions } from '@nestjs/bull';

export const redisConfig = (
  configService: ConfigService,
): BullModuleOptions => ({
  redis: {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: configService.get('REDIS_PORT', 6379),
    password: configService.get('REDIS_PASSWORD'),
    db: configService.get('REDIS_DB', 0),
  },
});