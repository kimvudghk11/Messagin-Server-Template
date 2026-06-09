import { MessageSendEvent } from './message-send.event';

export interface MessageDlqEvent extends MessageSendEvent {
  dispatchId: string;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  failedAt: string; // ISO 8601
}
