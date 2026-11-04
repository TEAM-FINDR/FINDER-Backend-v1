import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';

interface HttpRequestWithTraceId {
  traceId?: string;
}

interface HttpResponse {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestTraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequestWithTraceId>();
    const response = http.getResponse<HttpResponse>();
    const traceId = randomUUID();

    request.traceId = traceId;
    response.setHeader('x-request-id', traceId);

    return next.handle();
  }
}
