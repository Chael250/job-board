import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsSafeHtmlConstraint implements ValidatorConstraintInterface {
  validate(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return true; // Allow empty strings, other validators can handle required fields
    }

    // Check for potentially dangerous HTML tags and JavaScript
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi, // Event handlers like onclick, onload, etc.
      /<link\b[^>]*>/gi,
      /<meta\b[^>]*>/gi,
      /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    ];

    return !dangerousPatterns.some(pattern => pattern.test(text));
  }

  defaultMessage(): string {
    return 'Text contains potentially dangerous HTML content';
  }
}

export function IsSafeHtml(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSafeHtmlConstraint,
    });
  };
}