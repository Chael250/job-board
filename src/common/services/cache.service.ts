import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { MemoryCacheService } from './memory-cache.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: RedisClientType;
  private readonly defaultTTL = 300; // 5 minutes
  private redisAvailable = false;

  constructor(
    private configService: ConfigService,
    private memoryCacheService: MemoryCacheService,
  ) {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      this.redis = createClient({
        socket: {
          host: this.configService.get('REDIS_HOST', 'localhost'),
          port: this.configService.get('REDIS_PORT', 6379),
        },
        password: this.configService.get('REDIS_PASSWORD'),
        database: this.configService.get('REDIS_DB', 0),
      });

      this.redis.on('connect', () => {
        this.logger.log('Connected to Redis');
        this.redisAvailable = true;
      });

      this.redis.on('error', (err) => {
        this.logger.error('Redis Client Error', err);
        this.redisAvailable = false;
      });

      this.redis.on('end', () => {
        this.logger.warn('Redis connection ended');
        this.redisAvailable = false;
      });

      await this.redis.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis, falling back to memory cache', error);
      this.redisAvailable = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redisAvailable && this.redis && this.redis.isReady) {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value as string) : null;
      } else {
        // Fallback to memory cache
        return await this.memoryCacheService.get<T>(key);
      }
    } catch (error) {
      this.logger.error(`Failed to get cache key: ${key}`, error);
      // Try memory cache as fallback
      try {
        return await this.memoryCacheService.get<T>(key);
      } catch (fallbackError) {
        this.logger.error(`Memory cache fallback failed for key: ${key}`, fallbackError);
        return null;
      }
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      if (this.redisAvailable && this.redis && this.redis.isReady) {
        await this.redis.setEx(key, ttl, JSON.stringify(value));
      } else {
        // Fallback to memory cache
        await this.memoryCacheService.set(key, value, ttl);
      }
    } catch (error) {
      this.logger.error(`Failed to set cache key: ${key}`, error);
      // Try memory cache as fallback
      try {
        await this.memoryCacheService.set(key, value, ttl);
      } catch (fallbackError) {
        this.logger.error(`Memory cache fallback failed for key: ${key}`, fallbackError);
      }
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.redisAvailable && this.redis && this.redis.isReady) {
        await this.redis.del(key);
      } else {
        await this.memoryCacheService.del(key);
      }
    } catch (error) {
      this.logger.error(`Failed to delete cache key: ${key}`, error);
      // Try memory cache as fallback
      try {
        await this.memoryCacheService.del(key);
      } catch (fallbackError) {
        this.logger.error(`Memory cache fallback failed for key: ${key}`, fallbackError);
      }
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      if (this.redisAvailable && this.redis && this.redis.isReady) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      } else {
        await this.memoryCacheService.delPattern(pattern);
      }
    } catch (error) {
      this.logger.error(`Failed to delete cache pattern: ${pattern}`, error);
      // Try memory cache as fallback
      try {
        await this.memoryCacheService.delPattern(pattern);
      } catch (fallbackError) {
        this.logger.error(`Memory cache fallback failed for pattern: ${pattern}`, fallbackError);
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (this.redisAvailable && this.redis && this.redis.isReady) {
        const result = await this.redis.exists(key);
        return result === 1;
      } else {
        return await this.memoryCacheService.exists(key);
      }
    } catch (error) {
      this.logger.error(`Failed to check cache key existence: ${key}`, error);
      // Try memory cache as fallback
      try {
        return await this.memoryCacheService.exists(key);
      } catch (fallbackError) {
        this.logger.error(`Memory cache fallback failed for key: ${key}`, fallbackError);
        return false;
      }
    }
  }

  async increment(key: string, ttl: number = this.defaultTTL): Promise<number> {
    try {
      if (this.redisAvailable && this.redis && this.redis.isReady) {
        const result = await this.redis.incr(key);
        if (result === 1) {
          // Set TTL only on first increment
          await this.redis.expire(key, ttl);
        }
        return result;
      } else {
        // Memory cache doesn't support increment, so we simulate it
        const current = await this.memoryCacheService.get<number>(key) || 0;
        const newValue = current + 1;
        await this.memoryCacheService.set(key, newValue, ttl);
        return newValue;
      }
    } catch (error) {
      this.logger.error(`Failed to increment cache key: ${key}`, error);
      return 0;
    }
  }

  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}