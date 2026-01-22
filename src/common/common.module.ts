import { Module, Global } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { MemoryCacheService } from './services/memory-cache.service';
import { PerformanceService } from './services/performance.service';
import { QueryOptimizerService } from './services/query-optimizer.service';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { PerformanceInterceptor } from './interceptors/performance.interceptor';

@Global()
@Module({
  providers: [
    MemoryCacheService,
    CacheService,
    PerformanceService,
    QueryOptimizerService,
    CacheInterceptor,
    PerformanceInterceptor,
  ],
  exports: [
    MemoryCacheService,
    CacheService,
    PerformanceService,
    QueryOptimizerService,
    CacheInterceptor,
    PerformanceInterceptor,
  ],
})
export class CommonModule {}