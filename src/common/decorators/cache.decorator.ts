import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'cache_key';
export const CACHE_TTL = 'cache_ttl';

export interface CacheOptions {
  key?: string;
  ttl?: number;
  keyGenerator?: (...args: any[]) => string;
}

export const Cache = (options: CacheOptions = {}) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY, options.key || propertyName)(target, propertyName, descriptor);
    SetMetadata(CACHE_TTL, options.ttl || 300)(target, propertyName, descriptor);
    
    if (options.keyGenerator) {
      SetMetadata('cache_key_generator', options.keyGenerator)(target, propertyName, descriptor);
    }
    
    return descriptor;
  };
};