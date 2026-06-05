import { ErrorCode } from './error-code.enum';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_MISSING_HEADERS]: 'API 키 헤더(x-api-key, x-api-secret)가 누락되었습니다.',
  [ErrorCode.AUTH_INVALID_API_KEY]: '유효하지 않은 API 키입니다.',
  [ErrorCode.AUTH_API_KEY_INACTIVE]: 'API 키가 비활성화 상태입니다.',
  [ErrorCode.AUTH_API_KEY_EXPIRED]: 'API 키가 만료되었습니다.',
  [ErrorCode.AUTH_INVALID_SECRET]: 'API 시크릿이 올바르지 않습니다.',
  [ErrorCode.AUTH_CLIENT_APP_INACTIVE]: '클라이언트 앱이 비활성화 상태입니다.',
  [ErrorCode.AUTH_ADMIN_REQUIRED]: '관리자 권한이 필요합니다.',
  [ErrorCode.AUTH_IP_NOT_ALLOWED]: '허용되지 않은 IP 주소입니다.',
  [ErrorCode.PERM_INSUFFICIENT]: '해당 작업에 대한 권한이 없습니다.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
  [ErrorCode.MSG_TEMPLATE_NOT_FOUND]: '요청한 템플릿을 찾을 수 없습니다.',
  [ErrorCode.MSG_TEMPLATE_ACCESS_DENIED]: '해당 템플릿에 대한 접근 권한이 없습니다.',
  [ErrorCode.MSG_INVALID_VARIABLES]: '템플릿 변수가 올바르지 않습니다.',
  [ErrorCode.MSG_PAYLOAD_NOT_FOUND]: '메시지 payload를 찾을 수 없습니다.',
  [ErrorCode.MSG_REQUEST_DATA_MISSING]: '기존 요청의 데이터가 올바르지 않습니다.',
  [ErrorCode.MSG_KAFKA_PUBLISH_FAILED]: '메시지 요청은 저장되었지만 발행에 실패했습니다. 동일한 requestId로 재시도하세요.',
  [ErrorCode.CLIENT_APP_NOT_FOUND]: '클라이언트 앱을 찾을 수 없습니다.',
  [ErrorCode.SYS_INTERNAL_ERROR]: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
};
