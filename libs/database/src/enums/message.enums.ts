export enum ChannelGroupType {
  SINGLE = 'SINGLE',
  MULTI = 'MULTI',
}

export enum MessageType {
  TEMPLATE = 'TEMPLATE',
  RAW = 'RAW',
}

export enum MessagePriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum RecipientType {
  TO = 'TO',
  CC = 'CC',
  BCC = 'BCC',
}

export enum RecipientStatus {
  READY = 'READY',
  INVALID = 'INVALID',
  BLOCKED = 'BLOCKED',
}

export enum MessageRequestStatus {
  RECEIVED = 'RECEIVED',
  VALIDATED = 'VALIDATED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIAL_FAILED = 'PARTIAL_FAILED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

export enum MessageDispatchStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRY_WAIT = 'RETRY_WAIT',
  CANCELED = 'CANCELED',
}

export enum PayloadEncryptionStatus {
  PLAIN = 'PLAIN',
  MASKED = 'MASKED',
  ENCRYPTED = 'ENCRYPTED',
}

export enum DispatchLogType {
  REQUEST = 'REQUEST',
  RESPONSE = 'RESPONSE',
  RETRY = 'RETRY',
  SUCCESS = 'SUCCESS',
  FAIL = 'FAIL',
  CALLBACK = 'CALLBACK',
  STATUS_CHANGE = 'STATUS_CHANGE',
}

export enum DispatchLogStatus {
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}
