import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string[];
    timestamp: string;
    requestId?: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorResponse: ErrorResponse;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        // If the exception already has our error format, use it
        if ('error' in exceptionResponse) {
          errorResponse = exceptionResponse as ErrorResponse;
        } else {
          // Transform standard NestJS error format
          errorResponse = {
            error: {
              code: this.getErrorCode(status),
              message: (exceptionResponse as any).message || exception.message,
              details: Array.isArray((exceptionResponse as any).message) 
                ? (exceptionResponse as any).message 
                : undefined,
              timestamp: new Date().toISOString(),
            },
          };
        }
      } else {
        errorResponse = {
          error: {
            code: this.getErrorCode(status),
            message: exception.message,
            timestamp: new Date().toISOString(),
          },
        };
      }
    } else if (exception instanceof QueryFailedError) {
      // Handle database errors
      status = HttpStatus.BAD_REQUEST;
      errorResponse = {
        error: {
          code: 'DATABASE_ERROR',
          message: 'Database operation failed',
          timestamp: new Date().toISOString(),
        },
      };
      
      // Log the actual database error for debugging
      this.logger.error('Database error:', exception.message);
    } else {
      // Handle unexpected errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
      
      // Log the full error for debugging
      this.logger.error('Unexpected error:', exception);
    }

    // Add request ID if available
    const requestId = request.headers['x-request-id'] as string;
    if (requestId && errorResponse.error && typeof errorResponse.error === 'object') {
      errorResponse.error.requestId = requestId;
    }

    // Log security-related errors
    if (status === 401 || status === 403 || status === 429) {
      this.logger.warn(
        `Security event: ${status} ${request.method} ${request.url} - ${request.ip}`,
      );
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'UNKNOWN_ERROR';
    }
  }
}