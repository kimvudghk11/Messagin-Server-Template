export enum ChatRoomType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
  SUPPORT = 'SUPPORT',
}

export enum ChatRoomStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CLOSED = 'CLOSED',
}

export enum ChatParticipantRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum ChatParticipantStatus {
  JOINED = 'JOINED',
  LEFT = 'LEFT',
  BLOCKED = 'BLOCKED',
}

export enum ChatMessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
}

export enum ChatMessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  DELETED = 'DELETED',
}
