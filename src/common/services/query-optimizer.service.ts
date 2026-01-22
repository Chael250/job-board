import { Injectable, Logger } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { CacheService } from './cache.service';

export interface QueryOptimizationOptions {
  enableCache?: boolean;
  cacheTTL?: number;
  enablePagination?: boolean;
  maxLimit?: number;
  enableIndexHints?: boolean;
}

@Injectable()
export class QueryOptimizerService {
  private readonly logger = new Logger(QueryOptimizerService.name);
  private readonly defaultOptions: QueryOptimizationOptions = {
    enableCache: true,
    cacheTTL: 300, // 5 minutes
    enablePagination: true,
    maxLimit: 100,
    enableIndexHints: true,
  };

  constructor(
    private dataSource: DataSource,
    private cacheService: CacheService,
  ) {}

  /**
   * Optimize a query builder with caching and performance hints
   */
  async optimizeQuery<T>(
    queryBuilder: SelectQueryBuilder<T>,
    cacheKey?: string,
    options: QueryOptimizationOptions = {},
  ): Promise<T[]> {
    const opts = { ...this.defaultOptions, ...options };

    // Add performance hints for PostgreSQL
    if (opts.enableIndexHints) {
      this.addPerformanceHints(queryBuilder);
    }

    // Try cache first if enabled
    if (opts.enableCache && cacheKey) {
      const cachedResult = await this.cacheService.get<T[]>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
    }

    // Execute query with performance monitoring
    const startTime = Date.now();
    const result = await queryBuilder.getMany();
    const executionTime = Date.now() - startTime;

    // Log slow queries
    if (executionTime > 1000) {
      this.logger.warn(
        `Slow query detected (${executionTime}ms): ${queryBuilder.getQuery()}`,
      );
    }

    // Cache result if enabled
    if (opts.enableCache && cacheKey && result.length > 0) {
      await this.cacheService.set(cacheKey, result, opts.cacheTTL);
    }

    return result;
  }

  /**
   * Optimize paginated queries
   */
  async optimizePaginatedQuery<T>(
    queryBuilder: SelectQueryBuilder<T>,
    page: number,
    limit: number,
    cacheKey?: string,
    options: QueryOptimizationOptions = {},
  ): Promise<{ data: T[]; total: number }> {
    const opts = { ...this.defaultOptions, ...options };

    // Enforce maximum limit
    const safeLimit = Math.min(limit, opts.maxLimit || 100);
    const offset = (page - 1) * safeLimit;

    // Add performance hints
    if (opts.enableIndexHints) {
      this.addPerformanceHints(queryBuilder);
    }

    // Try cache first if enabled
    if (opts.enableCache && cacheKey) {
      const cachedResult = await this.cacheService.get<{ data: T[]; total: number }>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
    }

    // Clone query builder for count query
    const countQueryBuilder = queryBuilder.clone();

    // Execute both queries in parallel for better performance
    const startTime = Date.now();
    const [data, total] = await Promise.all([
      queryBuilder.skip(offset).take(safeLimit).getMany(),
      countQueryBuilder.getCount(),
    ]);
    const executionTime = Date.now() - startTime;

    // Log slow queries
    if (executionTime > 1000) {
      this.logger.warn(
        `Slow paginated query detected (${executionTime}ms): ${queryBuilder.getQuery()}`,
      );
    }

    const result = { data, total };

    // Cache result if enabled
    if (opts.enableCache && cacheKey) {
      await this.cacheService.set(cacheKey, result, opts.cacheTTL);
    }

    return result;
  }

  /**
   * Add PostgreSQL-specific performance hints
   */
  private addPerformanceHints<T>(queryBuilder: SelectQueryBuilder<T>): void {
    // Enable parallel query execution for large datasets
    queryBuilder.setParameter('max_parallel_workers_per_gather', 2);
    
    // Optimize join order
    queryBuilder.setParameter('join_collapse_limit', 8);
    
    // Use hash joins for large datasets
    queryBuilder.setParameter('enable_hashjoin', true);
    
    // Enable bitmap scans for better index usage
    queryBuilder.setParameter('enable_bitmapscan', true);
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  async analyzeQuery<T>(queryBuilder: SelectQueryBuilder<T>): Promise<{
    executionTime: number;
    rowCount: number;
    suggestions: string[];
  }> {
    const startTime = Date.now();
    
    // Get query execution plan
    const query = queryBuilder.getQuery();
    const parameters = queryBuilder.getParameters();
    
    try {
      // Execute EXPLAIN ANALYZE
      const explainResult = await this.dataSource.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
        Object.values(parameters),
      );

      const executionTime = Date.now() - startTime;
      const plan = explainResult[0]['QUERY PLAN'][0];
      
      const suggestions = this.generateOptimizationSuggestions(plan);
      
      return {
        executionTime,
        rowCount: plan['Actual Rows'] || 0,
        suggestions,
      };
    } catch (error) {
      this.logger.error('Failed to analyze query', error);
      return {
        executionTime: Date.now() - startTime,
        rowCount: 0,
        suggestions: ['Query analysis failed'],
      };
    }
  }

  /**
   * Generate optimization suggestions based on query plan
   */
  private generateOptimizationSuggestions(plan: any): string[] {
    const suggestions: string[] = [];

    // Check for sequential scans
    if (this.hasSequentialScan(plan)) {
      suggestions.push('Consider adding indexes for sequential scans');
    }

    // Check for high cost operations
    if (plan['Total Cost'] > 1000) {
      suggestions.push('Query has high cost, consider optimization');
    }

    // Check for nested loops with high row counts
    if (this.hasExpensiveNestedLoop(plan)) {
      suggestions.push('Consider using hash joins instead of nested loops');
    }

    // Check for sorts without indexes
    if (this.hasExpensiveSort(plan)) {
      suggestions.push('Consider adding indexes for ORDER BY clauses');
    }

    // Check execution time vs planning time
    if (plan['Execution Time'] > plan['Planning Time'] * 10) {
      suggestions.push('Query execution is much slower than planning, check for data skew');
    }

    return suggestions;
  }

  private hasSequentialScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') {
      return true;
    }
    
    if (plan['Plans']) {
      return plan['Plans'].some((subPlan: any) => this.hasSequentialScan(subPlan));
    }
    
    return false;
  }

  private hasExpensiveNestedLoop(plan: any): boolean {
    if (plan['Node Type'] === 'Nested Loop' && plan['Actual Rows'] > 1000) {
      return true;
    }
    
    if (plan['Plans']) {
      return plan['Plans'].some((subPlan: any) => this.hasExpensiveNestedLoop(subPlan));
    }
    
    return false;
  }

  private hasExpensiveSort(plan: any): boolean {
    if (plan['Node Type'] === 'Sort' && plan['Total Cost'] > 100) {
      return true;
    }
    
    if (plan['Plans']) {
      return plan['Plans'].some((subPlan: any) => this.hasExpensiveSort(subPlan));
    }
    
    return false;
  }

  /**
   * Create optimized cache key for queries
   */
  generateCacheKey(
    entityName: string,
    operation: string,
    filters: Record<string, any> = {},
    pagination?: { page: number; limit: number },
  ): string {
    const filterKey = Object.keys(filters)
      .sort()
      .map(key => `${key}:${filters[key]}`)
      .join('|');
    
    const paginationKey = pagination ? `p:${pagination.page}:${pagination.limit}` : '';
    
    return this.cacheService.generateKey(
      'query',
      entityName,
      operation,
      filterKey,
      paginationKey,
    );
  }
}