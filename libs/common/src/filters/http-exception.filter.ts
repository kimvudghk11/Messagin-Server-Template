import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code.enum';
import { ERROR_MESSAGES } from '../errors/error-messages';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, errorCode } = this.resolveException(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(`${request.method} ${request.url} → ${statusCode}: ${message}`);
    }

    response.status(statusCode).json({
      success: false,
      errorCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    message: string;
    errorCode: string | null;
  } {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        errorCode: exception.errorCode,
        message: ERROR_MESSAGES[exception.errorCode as ErrorCode],
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();
      let message: string;
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const raw = (res as Record<string, unknown>)['message'];
        message = Array.isArray(raw) ? raw.join(', ') : String(raw);
      } else {
        message = exception.message;
      }
      return { statusCode, message, errorCode: null };
    }

    return {
      statusCode: 500,
      errorCode: ErrorCode.SYS_INTERNAL_ERROR,
      message: ERROR_MESSAGES[ErrorCode.SYS_INTERNAL_ERROR],
    };
  }
}
