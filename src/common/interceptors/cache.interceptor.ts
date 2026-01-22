import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../services/cache.service';
import { CACHE_KEY, CACHE_TTL } from '../decorators/cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private cacheService: CacheService,
    private reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const cacheKey = this.reflector.get<string>(CACHE_KEY, context.getHandler());
    const cacheTTL = this.reflector.get<number>(CACHE_TTL, context.getHandler());
    const keyGenerator = this.reflector.get<Function>('cache_key_generator', context.getHandler());

    if (!cacheKey) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const finalKey = keyGenerator 
      ? keyGenerator(request.params, request.query, request.user)
      : this.generateCacheKey(cacheKey, request);

    // Try to get from cache
    const cachedResult = await this.cacheService.get(finalKey);
    if (cachedResult !== null) {
      return of(cachedResult);
    }

    // If not in cache, execute the method and cache the result
    return next.handle().pipe(
      tap(async (result) => {
        if (result !== null && result !== undefined) {
          await this.cacheService.set(finalKey, result, cacheTTL);
        }
      }),
    );
  }

  private generateCacheKey(baseKey: string, request: any): string {
    const params = JSON.stringify(request.params || {});
    const query = JSON.stringify(request.query || {});
    const userId = request.user?.id || 'anonymous';
    
    return this.cacheService.generateKey(baseKey, userId, params, query);
  }
}