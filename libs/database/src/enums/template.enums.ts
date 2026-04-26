export enum TemplateCategory {
  AUTH = 'AUTH',
  BILLING = 'BILLING',
  SYSTEM = 'SYSTEM',
  MARKETING = 'MARKETING',
  SUPPORT = 'SUPPORT',
  SECURITY = 'SECURITY',
  ETC = 'ETC',
}

export enum ContentFormat {
  TEXT = 'TEXT',
  HTML = 'HTML',
  JSON = 'JSON',
}

export enum TemplateChannelStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEPRECATED = 'DEPRECATED',
}

export enum TemplateVariableDataType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  OBJECT = 'OBJECT',
  ARRAY = 'ARRAY',
}

export enum TemplateAccessScope {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  RESTRICTED = 'RESTRICTED',
}

export enum ProviderType {
  AWS_SES = 'AWS_SES',
  SMS_VENDOR = 'SMS_VENDOR',
  KAKAO_VENDOR = 'KAKAO_VENDOR',
  INTERNAL_CHAT = 'INTERNAL_CHAT',
}
