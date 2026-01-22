import { Test, TestingModule } from '@nestjs/testing';
import { MemoryCacheService } from './memory-cache.service';
import { CacheService } from './cache.service';
import { ConfigService } from '@nestjs/config';

describe('Performance Optimizations', () => {
  let memoryCacheService: MemoryCacheService;
  let cacheService: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryCacheService,
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                REDIS_DB: 0,
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    memoryCacheService = module.get<MemoryCacheService>(MemoryCacheService);
    cacheService = module.get<CacheService>(CacheService);
  });

  describe('MemoryCacheService', () => {
    it('should store and retrieve values', async () => {
      const key = 'test-key';
      const value = { data: 'test-data', timestamp: Date.now() };

      await memoryCacheService.set(key, value, 60);
      const retrieved = await memoryCacheService.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should handle expiration correctly', async () => {
      const key = 'expiring-key';
      const value = 'expiring-value';

      // Set with 1 second TTL
      await memoryCacheService.set(key, value, 1);
      
      // Should exist immediately
      expect(await memoryCacheService.exists(key)).toBe(true);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      expect(await memoryCacheService.exists(key)).toBe(false);
      expect(await memoryCacheService.get(key)).toBeNull();
    });

    it('should handle pattern deletion', async () => {
      await memoryCacheService.set('user:1:profile', { name: 'John' }, 60);
      await memoryCacheService.set('user:2:profile', { name: 'Jane' }, 60);
      await memoryCacheService.set('job:1:details', { title: 'Developer' }, 60);

      // Delete all user profiles
      await memoryCacheService.delPattern('user:*:profile');

      expect(await memoryCacheService.exists('user:1:profile')).toBe(false);
      expect(await memoryCacheService.exists('user:2:profile')).toBe(false);
      expect(await memoryCacheService.exists('job:1:details')).toBe(true);
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const operations = 1000;

      // Perform many cache operations
      const promises = [];
      for (let i = 0; i < operations; i++) {
        promises.push(memoryCacheService.set(`key-${i}`, `value-${i}`, 60));
      }
      await Promise.all(promises);

      // Retrieve all values
      const retrievePromises = [];
      for (let i = 0; i < operations; i++) {
        retrievePromises.push(memoryCacheService.get(`key-${i}`));
      }
      const results = await Promise.all(retrievePromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second for 1000 operations)
      expect(duration).toBeLessThan(1000);
      expect(results).toHaveLength(operations);
      expect(results[0]).toBe('value-0');
      expect(results[operations - 1]).toBe(`value-${operations - 1}`);
    });

    it('should handle cache eviction when at capacity', async () => {
      const stats = memoryCacheService.getStats();
      const maxSize = stats.maxSize;

      // Fill cache beyond capacity
      for (let i = 0; i < maxSize + 100; i++) {
        await memoryCacheService.set(`key-${i}`, `value-${i}`, 60);
      }

      const finalStats = memoryCacheService.getStats();
      expect(finalStats.size).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('CacheService with Memory Fallback', () => {
    it('should fallback to memory cache when Redis is unavailable', async () => {
      const key = 'fallback-test';
      const value = { test: 'data' };

      // This should use memory cache since Redis is not available in test
      await cacheService.set(key, value, 60);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should handle cache key generation', () => {
      const key = cacheService.generateKey('jobs', 'public', 'filter1', 'page1');
      expect(key).toBe('jobs:public:filter1:page1');
    });

    it('should handle concurrent operations efficiently', async () => {
      const startTime = Date.now();
      const operations = 100;

      // Perform concurrent cache operations
      const promises = [];
      for (let i = 0; i < operations; i++) {
        promises.push(
          cacheService.set(`concurrent-${i}`, { data: i }, 60)
            .then(() => cacheService.get(`concurrent-${i}`))
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(500);
      expect(results).toHaveLength(operations);
      expect(results[0]).toEqual({ data: 0 });
    });
  });

  describe('Performance Metrics', () => {
    it('should measure cache hit rates', async () => {
      const testKey = 'performance-test';
      const testValue = { performance: 'data' };

      // First access - cache miss
      let startTime = Date.now();
      await cacheService.set(testKey, testValue, 60);
      let setTime = Date.now() - startTime;

      // Second access - cache hit
      startTime = Date.now();
      const cachedValue = await cacheService.get(testKey);
      let getTime = Date.now() - startTime;

      expect(cachedValue).toEqual(testValue);
      expect(getTime).toBeLessThan(setTime); // Cache hit should be faster
      expect(getTime).toBeLessThan(10); // Should be very fast (< 10ms)
    });

    it('should handle memory usage efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create many cache entries
      for (let i = 0; i < 1000; i++) {
        await memoryCacheService.set(`memory-test-${i}`, {
          id: i,
          data: `test-data-${i}`,
          timestamp: Date.now(),
        }, 60);
      }

      const afterCacheMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterCacheMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 1000 entries)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      // Clear cache
      await memoryCacheService.clear();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryAfterCleanup = finalMemory - initialMemory;

      // Memory should be mostly reclaimed
      expect(memoryAfterCleanup).toBeLessThan(memoryIncrease / 2);
    });
  });
});