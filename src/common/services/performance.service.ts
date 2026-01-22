import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  userId?: string;
}

export interface PerformanceStats {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalRequests: number;
  errorRate: number;
}

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);
  private readonly metricsBuffer: PerformanceMetrics[] = [];
  private readonly bufferSize = 1000;
  private readonly flushInterval = 60000; // 1 minute

  constructor(private cacheService: CacheService) {
    // Flush metrics to cache periodically
    setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);
  }

  recordMetric(metric: PerformanceMetrics): void {
    this.metricsBuffer.push(metric);

    // Log slow requests
    if (metric.responseTime > 1000) {
      this.logger.warn(
        `Slow request detected: ${metric.method} ${metric.endpoint} - ${metric.responseTime}ms`,
      );
    }

    // Flush buffer if it's full
    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flushMetrics();
    }
  }

  async getPerformanceStats(
    endpoint?: string,
    timeWindow: number = 3600, // 1 hour default
  ): Promise<PerformanceStats> {
    const cacheKey = this.cacheService.generateKey(
      'performance:stats',
      endpoint || 'all',
      timeWindow.toString(),
    );

    // Try cache first
    const cachedStats = await this.cacheService.get<PerformanceStats>(cacheKey);
    if (cachedStats) {
      return cachedStats;
    }

    // Calculate stats from recent metrics
    const cutoffTime = new Date(Date.now() - timeWindow * 1000);
    const recentMetrics = await this.getRecentMetrics(endpoint, cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
      };
    }

    const responseTimes = recentMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;

    const stats: PerformanceStats = {
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      totalRequests: recentMetrics.length,
      errorRate: (errorCount / recentMetrics.length) * 100,
    };

    // Cache stats for 5 minutes
    await this.cacheService.set(cacheKey, stats, 300);

    return stats;
  }

  async getSlowQueries(limit: number = 10): Promise<PerformanceMetrics[]> {
    const cacheKey = this.cacheService.generateKey('performance:slow_queries', limit.toString());
    
    const cachedQueries = await this.cacheService.get<PerformanceMetrics[]>(cacheKey);
    if (cachedQueries) {
      return cachedQueries;
    }

    // Get recent metrics and find slowest ones
    const cutoffTime = new Date(Date.now() - 3600000); // Last hour
    const recentMetrics = await this.getRecentMetrics(undefined, cutoffTime);
    
    const slowQueries = recentMetrics
      .filter(m => m.responseTime > 500) // Only queries slower than 500ms
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, limit);

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, slowQueries, 300);

    return slowQueries;
  }

  async getEndpointStats(): Promise<Record<string, PerformanceStats>> {
    const cacheKey = 'performance:endpoint_stats';
    
    const cachedStats = await this.cacheService.get<Record<string, PerformanceStats>>(cacheKey);
    if (cachedStats) {
      return cachedStats;
    }

    const cutoffTime = new Date(Date.now() - 3600000); // Last hour
    const recentMetrics = await this.getRecentMetrics(undefined, cutoffTime);

    // Group metrics by endpoint
    const endpointGroups = recentMetrics.reduce((groups, metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetrics[]>);

    // Calculate stats for each endpoint
    const endpointStats: Record<string, PerformanceStats> = {};
    
    for (const [endpoint, metrics] of Object.entries(endpointGroups)) {
      const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
      const errorCount = metrics.filter(m => m.statusCode >= 400).length;

      endpointStats[endpoint] = {
        averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        p95ResponseTime: this.calculatePercentile(responseTimes, 95),
        p99ResponseTime: this.calculatePercentile(responseTimes, 99),
        totalRequests: metrics.length,
        errorRate: (errorCount / metrics.length) * 100,
      };
    }

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, endpointStats, 300);

    return endpointStats;
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    try {
      // Store metrics in cache with timestamp-based keys
      const timestamp = Date.now();
      const cacheKey = this.cacheService.generateKey('performance:metrics', timestamp.toString());
      
      // Store current buffer
      await this.cacheService.set(cacheKey, [...this.metricsBuffer], 3600); // Keep for 1 hour
      
      // Clear buffer
      this.metricsBuffer.length = 0;

      // Clean up old metrics (keep only last 24 hours)
      const cutoffTimestamp = timestamp - 24 * 60 * 60 * 1000;
      await this.cleanupOldMetrics(cutoffTimestamp);

    } catch (error) {
      this.logger.error('Failed to flush performance metrics', error);
    }
  }

  private async getRecentMetrics(
    endpoint?: string,
    cutoffTime?: Date,
  ): Promise<PerformanceMetrics[]> {
    const allMetrics: PerformanceMetrics[] = [];
    
    // Get metrics from cache (last 24 hours)
    const now = Date.now();
    const startTime = cutoffTime ? cutoffTime.getTime() : now - 24 * 60 * 60 * 1000;
    
    // Search through cached metric buckets
    for (let timestamp = startTime; timestamp <= now; timestamp += this.flushInterval) {
      const cacheKey = this.cacheService.generateKey('performance:metrics', timestamp.toString());
      const metrics = await this.cacheService.get<PerformanceMetrics[]>(cacheKey);
      
      if (metrics) {
        allMetrics.push(...metrics);
      }
    }

    // Add current buffer
    allMetrics.push(...this.metricsBuffer);

    // Filter by endpoint and time if specified
    return allMetrics.filter(metric => {
      const timeMatch = !cutoffTime || metric.timestamp >= cutoffTime;
      const endpointMatch = !endpoint || metric.endpoint === endpoint;
      return timeMatch && endpointMatch;
    });
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private async cleanupOldMetrics(cutoffTimestamp: number): Promise<void> {
    try {
      // Remove metrics older than cutoff
      const pattern = 'performance:metrics:*';
      await this.cacheService.delPattern(pattern);
    } catch (error) {
      this.logger.error('Failed to cleanup old performance metrics', error);
    }
  }
}