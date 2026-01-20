import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { sanitizeHtml, sanitizeText } from '../utils/sanitization.util';

@Injectable()
export class SecurityValidationPipe extends NestValidationPipe implements PipeTransform {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.map(error => {
          const constraints = error.constraints;
          return constraints ? Object.values(constraints).join(', ') : 'Validation failed';
        });
        return new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: messages,
            timestamp: new Date().toISOString(),
          },
        });
      },
    });
  }

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    // Apply sanitization before validation
    if (value && typeof value === 'object') {
      this.sanitizeObject(value);
    }

    // Use parent validation logic
    return super.transform(value, metadata);
  }

  private sanitizeObject(obj: any): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        
        if (typeof value === 'string') {
          // Apply appropriate sanitization based on field name
          if (this.isHtmlField(key)) {
            obj[key] = sanitizeHtml(value);
          } else {
            obj[key] = sanitizeText(value);
          }
        } else if (typeof value === 'object' && value !== null) {
          // Recursively sanitize nested objects
          this.sanitizeObject(value);
        }
      }
    }
  }

  private isHtmlField(fieldName: string): boolean {
    // Fields that might contain HTML content
    const htmlFields = ['description', 'requirements', 'coverLetter', 'companyDescription'];
    return htmlFields.includes(fieldName);
  }
}