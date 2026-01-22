import { Injectable, Logger } from '@nestjs/common';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class MemoryCacheService {
  private readonly logger = new Logger(MemoryCacheService.name);
  private readonly cache = new Map<string, CacheItem<any>>();
  private readonly maxSize = 1000; // Maximum number of items to cache
  private readonly cleanupInterval = 60000; // Clean up every minute

  constructor() {
    // Start cleanup interval
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    // If cache is at max size, remove oldest items
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    // Check if item has expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      this.logger.debug(`Cleaned up ${keysToDelete.length} expired cache items`);
    }
  }

  private evictOldest(): void {
    // Remove 10% of items when at capacity
    const itemsToRemove = Math.floor(this.maxSize * 0.1);
    const keys = Array.from(this.cache.keys());
    
    for (let i = 0; i < itemsToRemove && keys.length > 0; i++) {
      this.cache.delete(keys[i]);
    }

    this.logger.debug(`Evicted ${itemsToRemove} items from memory cache`);
  }
}