import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    version: string;
    requestId?: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    return next.handle().pipe(
      map((data) => {
        // Don't transform if data is already in our format or is a file stream
        if (data && typeof data === 'object' && ('data' in data || 'error' in data)) {
          return data;
        }

        // Don't transform file responses
        if (response.getHeader('content-type')?.toString().includes('application/octet-stream')) {
          return data;
        }

        const result: ApiResponse<T> = {
          data,
          meta: {
            timestamp: new Date().toISOString(),
            version: 'v1',
          },
        };

        // Add request ID if available
        const requestId = request.headers['x-request-id'] as string;
        if (requestId) {
          result.meta.requestId = requestId;
        }

        // Add pagination info if present in headers
        const totalCount = response.getHeader('X-Total-Count');
        const pageCount = response.getHeader('X-Page-Count');
        const currentPage = request.query.page;
        const limit = request.query.limit;

        if (totalCount && pageCount && currentPage && limit) {
          result.pagination = {
            page: parseInt(currentPage as string, 10),
            limit: parseInt(limit as string, 10),
            total: parseInt(totalCount as string, 10),
            totalPages: parseInt(pageCount as string, 10),
          };
        }

        return result;
      }),
    );
  }
}