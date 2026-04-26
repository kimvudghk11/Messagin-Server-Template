export interface MessageSendEvent {
  messageRequestId: string;
  requestId: string;
  recipientId: string;
  clientAppId: string;
  templateCode: string;
  channel: string;
  receiver: Record<string, unknown>;
  variables: Record<string, unknown>;
  priority: string;
  callbackUrl: string | null;
  requestedAt: string;
}
