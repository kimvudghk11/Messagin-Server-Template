import { HttpException } from '@nestjs/common';
import { AppException } from '../../src/errors/app.exception';
import { ErrorCode } from '../../src/errors/error-code.enum';
import { ERROR_MESSAGES } from '../../src/errors/error-messages';

describe('AppException', () => {
  it('stores the errorCode', () => {
    const ex = new AppException(ErrorCode.AUTH_INVALID_API_KEY, 401);
    expect(ex.errorCode).toBe(ErrorCode.AUTH_INVALID_API_KEY);
  });

  it('sets HTTP status from constructor', () => {
    const ex = new AppException(ErrorCode.RATE_LIMIT_EXCEEDED, 429);
    expect(ex.getStatus()).toBe(429);
  });

  it('includes Korean message from ERROR_MESSAGES in response', () => {
    const ex = new AppException(ErrorCode.AUTH_INVALID_API_KEY, 401);
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body['message']).toBe(ERROR_MESSAGES[ErrorCode.AUTH_INVALID_API_KEY]);
  });

  it('includes errorCode in response body', () => {
    const ex = new AppException(ErrorCode.PERM_INSUFFICIENT, 403);
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body['errorCode']).toBe(ErrorCode.PERM_INSUFFICIENT);
  });

  it('is instanceof HttpException', () => {
    const ex = new AppException(ErrorCode.SYS_INTERNAL_ERROR, 500);
    expect(ex).toBeInstanceOf(HttpException);
    expect(ex).toBeInstanceOf(AppException);
  });
});
