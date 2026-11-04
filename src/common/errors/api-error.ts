import { HttpException } from '@nestjs/common';

export const ApiErrorCode = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode =
  (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export interface ApiErrorResponse {
  code: ApiErrorCode;
  message: string;
  field?: string;
  traceId: string;
}

export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message, status);
  }
}
