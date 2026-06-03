import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChatMessageEntity,
  ChatMessageReadEntity,
  ChatMessageStatus,
  ChatMessageType,
  ChatRoomEntity,
  ChatRoomParticipantEntity,
  ChatParticipantStatus,
} from '@app/database';

@Injectable()
export class ChatRoomService {
  constructor(
    @InjectRepository(ChatRoomEntity)
    private readonly roomRepository: Repository<ChatRoomEntity>,
    @InjectRepository(ChatRoomParticipantEntity)
    private readonly participantRepository: Repository<ChatRoomParticipantEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepository: Repository<ChatMessageEntity>,
    @InjectRepository(ChatMessageReadEntity)
    private readonly readRepository: Repository<ChatMessageReadEntity>,
  ) {}

  async findRoom(roomId: string): Promise<ChatRoomEntity | null> {
    return this.roomRepository.findOne({ where: { id: roomId } });
  }

  async isParticipant(roomId: string, userId: string): Promise<boolean> {
    const participant = await this.participantRepository.findOne({
      where: { roomId, userId, status: ChatParticipantStatus.JOINED },
    });
    return participant !== null;
  }

  async saveMessage(roomId: string, senderUserId: string, content: string): Promise<ChatMessageEntity> {
    const message = this.messageRepository.create({
      roomId,
      senderUserId,
      messageType: ChatMessageType.TEXT,
      content,
      status: ChatMessageStatus.SENT,
      metadata: null,
      sentAt: new Date(),
    });
    return this.messageRepository.save(message);
  }

  async getRecentMessages(roomId: string, limit = 50): Promise<ChatMessageEntity[]> {
    return this.messageRepository.find({
      where: { roomId },
      order: { sentAt: 'DESC' },
      take: limit,
    });
  }

  async markRead(messageId: string, userId: string): Promise<void> {
    const existing = await this.readRepository.findOne({
      where: { messageId, userId },
    });
    if (!existing) {
      const entry = this.readRepository.create({
        messageId,
        userId,
        readAt: new Date(),
      });
      await this.readRepository.save(entry);
    }
  }
}
