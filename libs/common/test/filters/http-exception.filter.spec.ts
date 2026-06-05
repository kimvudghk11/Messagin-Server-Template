import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from '../../src/filters/http-exception.filter';
import { AppException } from '../../src/errors/app.exception';
import { ErrorCode } from '../../src/errors/error-code.enum';
import { ERROR_MESSAGES } from '../../src/errors/error-messages';

function makeHost(method = 'GET', url = '/test'): {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { method, url };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, json, status };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('HttpException (4xx)', () => {
    it('returns correct status and message for string response', () => {
      const { host, status, json } = makeHost();
      filter.catch(new HttpException('Bad request', HttpStatus.BAD_REQUEST), host);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: null,
          message: 'Bad request',
          path: '/test',
        }),
      );
    });

    it('extracts message from object response', () => {
      const { host, json } = makeHost();
      filter.catch(
        new HttpException({ message: 'Validation failed', error: 'Bad Request' }, 400),
        host,
      );

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Validation failed' }),
      );
    });

    it('joins array messages into single string', () => {
      const { host, json } = makeHost();
      filter.catch(
        new HttpException({ message: ['name is required', 'email is invalid'] }, 400),
        host,
      );

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'name is required, email is invalid' }),
      );
    });

    it('logs at debug level for 4xx — not error level', () => {
      const { host } = makeHost();
      filter.catch(new HttpException('Not found', 404), host);

      expect(debugSpy).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('includes timestamp and path in response', () => {
      const { host, json } = makeHost('POST', '/messages/send');
      filter.catch(new HttpException('Forbidden', 403), host);

      const [call] = json.mock.calls;
      expect(call[0]).toHaveProperty('timestamp');
      expect(call[0]).toHaveProperty('path', '/messages/send');
    });
  });

  describe('AppException', () => {
    it('includes errorCode in response', () => {
      const { host, json } = makeHost();
      filter.catch(new AppException(ErrorCode.AUTH_INVALID_API_KEY, 401), host);

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: ErrorCode.AUTH_INVALID_API_KEY,
          message: ERROR_MESSAGES[ErrorCode.AUTH_INVALID_API_KEY],
        }),
      );
    });

    it('shows Korean message even for 5xx AppException', () => {
      const { host, status, json } = makeHost();
      filter.catch(new AppException(ErrorCode.MSG_KAFKA_PUBLISH_FAILED, 503), host);

      expect(status).toHaveBeenCalledWith(503);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.MSG_KAFKA_PUBLISH_FAILED,
          message: ERROR_MESSAGES[ErrorCode.MSG_KAFKA_PUBLISH_FAILED],
        }),
      );
    });

    it('logs at error level for 5xx AppException', () => {
      const { host } = makeHost();
      filter.catch(new AppException(ErrorCode.MSG_KAFKA_PUBLISH_FAILED, 503), host);

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Generic Error — SYS_001', () => {
    it('returns 500 with SYS_001 errorCode and Korean message', () => {
      const { host, status, json } = makeHost();
      filter.catch(new Error('Database connection failed'), host);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: ErrorCode.SYS_INTERNAL_ERROR,
          message: ERROR_MESSAGES[ErrorCode.SYS_INTERNAL_ERROR],
        }),
      );
    });

    it('logs at error level with stack trace for 5xx', () => {
      const { host } = makeHost();
      filter.catch(new Error('Unexpected crash'), host);

      expect(errorSpy).toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('handles non-Error throws gracefully', () => {
      const { host, status, json } = makeHost();
      filter.catch('plain string thrown', host);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.SYS_INTERNAL_ERROR,
          message: ERROR_MESSAGES[ErrorCode.SYS_INTERNAL_ERROR],
        }),
      );
    });
  });
});
