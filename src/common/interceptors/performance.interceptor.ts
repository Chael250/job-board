import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PerformanceService } from '../services/performance.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private performanceService: PerformanceService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetric(request, response, startTime);
        },
        error: () => {
          this.recordMetric(request, response, startTime);
        },
      }),
    );
  }

  private recordMetric(request: any, response: any, startTime: number): void {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Extract endpoint path without query parameters
    const endpoint = this.normalizeEndpoint(request.route?.path || request.url);

    this.performanceService.recordMetric({
      endpoint,
      method: request.method,
      responseTime,
      statusCode: response.statusCode,
      timestamp: new Date(startTime),
      userId: request.user?.id,
    });
  }

  private normalizeEndpoint(path: string): string {
    // Remove query parameters
    const cleanPath = path.split('?')[0];
    
    // Replace UUID parameters with placeholder
    const uuidRegex = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    return cleanPath.replace(uuidRegex, '/:id');
  }
}