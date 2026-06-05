import { HttpException } from '@nestjs/common';
import { ErrorCode } from './error-code.enum';
import { ERROR_MESSAGES } from './error-messages';

export class AppException extends HttpException {
  readonly errorCode: ErrorCode;

  constructor(errorCode: ErrorCode, statusCode: number) {
    super({ errorCode, message: ERROR_MESSAGES[errorCode] }, statusCode);
    this.errorCode = errorCode;
  }
}
