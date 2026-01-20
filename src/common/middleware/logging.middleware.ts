import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();

    // Log request
    this.logger.log(
      `${method} ${originalUrl} - ${ip} - ${userAgent}`,
    );

    // Log response when finished
    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length') || 0;
      const responseTime = Date.now() - startTime;

      const logLevel = statusCode >= 400 ? 'error' : 'log';
      this.logger[logLevel](
        `${method} ${originalUrl} ${statusCode} ${contentLength} - ${responseTime}ms - ${ip}`,
      );

      // Log security events
      if (statusCode === 401) {
        this.logger.warn(`Unauthorized access attempt: ${method} ${originalUrl} - ${ip}`);
      } else if (statusCode === 403) {
        this.logger.warn(`Forbidden access attempt: ${method} ${originalUrl} - ${ip}`);
      } else if (statusCode === 429) {
        this.logger.warn(`Rate limit exceeded: ${method} ${originalUrl} - ${ip}`);
      }
    });

    next();
  }
}