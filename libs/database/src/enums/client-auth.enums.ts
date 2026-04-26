export enum ClientAppStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export enum ApiKeyStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum ApiKeyType {
  SERVER = 'SERVER',
  ADMIN = 'ADMIN',
  WORKER = 'WORKER',
}

export enum AuthMethodType {
  API_KEY = 'API_KEY',
  HMAC = 'HMAC',
  JWT = 'JWT',
}

export enum ClientPermissionType {
  SEND_MESSAGE = 'SEND_MESSAGE',
  READ_TEMPLATE = 'READ_TEMPLATE',
  READ_TEMPLATE_VARIABLE = 'READ_TEMPLATE_VARIABLE',
  READ_DELIVERY_STATUS = 'READ_DELIVERY_STATUS',
  READ_LOG = 'READ_LOG',
  USE_CHAT = 'USE_CHAT',
  ADMIN_ACCESS = 'ADMIN_ACCESS',
}

export enum ChannelType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  KAKAO = 'KAKAO',
  CHAT = 'CHAT',
}
