import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERNSHIP = 'internship',
}

@ValidatorConstraint({ async: false })
export class IsValidEmploymentTypeConstraint implements ValidatorConstraintInterface {
  validate(employmentType: any): boolean {
    return Object.values(EmploymentType).includes(employmentType);
  }

  defaultMessage(): string {
    return `Employment type must be one of: ${Object.values(EmploymentType).join(', ')}`;
  }
}

export function IsValidEmploymentType(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidEmploymentTypeConstraint,
    });
  };
}