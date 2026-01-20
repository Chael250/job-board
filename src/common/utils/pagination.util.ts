import { Response } from 'express';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function createPaginationResponse<T>(
  data: T[],
  total: number,
  options: PaginationOptions,
  response?: Response,
): PaginationResult<T> {
  const totalPages = Math.ceil(total / options.limit);
  
  const result: PaginationResult<T> = {
    data,
    total,
    page: options.page,
    limit: options.limit,
    totalPages,
  };

  // Set pagination headers if response object is provided
  if (response) {
    response.setHeader('X-Total-Count', total.toString());
    response.setHeader('X-Page-Count', totalPages.toString());
    response.setHeader('X-Current-Page', options.page.toString());
    response.setHeader('X-Per-Page', options.limit.toString());
  }

  return result;
}

export function validatePaginationOptions(
  page?: number,
  limit?: number,
): PaginationOptions {
  const validatedPage = Math.max(1, page || 1);
  const validatedLimit = Math.min(Math.max(1, limit || 10), 100); // Max 100 items per page

  return {
    page: validatedPage,
    limit: validatedLimit,
  };
}