import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

export const HTTP_REQUESTS_TOTAL = 'http_requests_total';
export const HTTP_REQUEST_DURATION_SECONDS = 'http_request_duration_seconds';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUESTS_TOTAL)
    private readonly requestCounter: Counter<string>,
    @InjectMetric(HTTP_REQUEST_DURATION_SECONDS)
    private readonly requestDuration: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.record(req, res.statusCode, startTime),
        error: (err: { status?: number }) =>
          this.record(req, err.status ?? 500, startTime),
      }),
    );
  }

  private record(req: Request, statusCode: number, startTime: number): void {
    const labels = {
      method: req.method,
      path: req.route?.path ?? req.path,
      status: String(statusCode),
    };
    this.requestCounter.inc(labels);
    this.requestDuration.observe(labels, (Date.now() - startTime) / 1000);
  }
}
