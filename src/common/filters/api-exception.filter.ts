import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ApiErrorCode,
  ApiErrorResponse,
  ApiException,
} from '../errors/api-error';

interface HttpRequestWithTraceId {
  method: string;
  url: string;
  traceId?: string;
}

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: ApiErrorResponse): void;
  setHeader(name: string, value: string): void;
}

const errorByStatus: Record<
  number,
  { code: ApiErrorCode; message: string }
> = {
  [HttpStatus.BAD_REQUEST]: {
    code: ApiErrorCode.INVALID_REQUEST,
    message: '요청 값이 유효하지 않습니다.',
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: ApiErrorCode.AUTH_TOKEN_INVALID,
    message: '인증 토큰이 유효하지 않습니다.',
  },
  [HttpStatus.FORBIDDEN]: {
    code: ApiErrorCode.PERMISSION_DENIED,
    message: '요청을 수행할 권한이 없습니다.',
  },
  [HttpStatus.NOT_FOUND]: {
    code: ApiErrorCode.RESOURCE_NOT_FOUND,
    message: '요청한 리소스를 찾을 수 없습니다.',
  },
  [HttpStatus.CONFLICT]: {
    code: ApiErrorCode.RESOURCE_CONFLICT,
    message: '현재 상태에서는 요청을 처리할 수 없습니다.',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: ApiErrorCode.RATE_LIMITED,
    message: '잠시 후 다시 시도해 주세요.',
  },
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequestWithTraceId>();
    const response = context.getResponse<HttpResponse>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const knownError = errorByStatus[status];
    const internalError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    const apiException = exception instanceof ApiException ? exception : null;
    const traceId = request.traceId ?? randomUUID();

    request.traceId = traceId;
    response.setHeader('x-request-id', traceId);

    const body: ApiErrorResponse = {
      code: internalError
        ? ApiErrorCode.INTERNAL_ERROR
        : (apiException?.code ??
          knownError?.code ??
          ApiErrorCode.INVALID_REQUEST),
      message: internalError
        ? '서버 내부 오류가 발생했습니다.'
        : (apiException?.message ??
          knownError?.message ??
          '요청을 처리할 수 없습니다.'),
      ...(apiException?.field ? { field: apiException.field } : {}),
      traceId,
    };

    const logEntry = JSON.stringify({
      traceId,
      method: request.method,
      path: request.url.split('?')[0],
      status,
      code: body.code,
    });
    if (internalError) {
      this.logger.error(
        logEntry,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(logEntry);
    }

    response.status(status).json(body);
  }
}
