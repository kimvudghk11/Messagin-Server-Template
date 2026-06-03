import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatRoomService } from './chat-room.service';

export interface JoinRoomPayload {
  roomId: string;
  userId: string;
}

export interface SendMessagePayload {
  roomId: string;
  userId: string;
  content: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatRoomService: ChatRoomService) { }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ): Promise<void> {
    const { roomId, userId } = payload;

    const room = await this.chatRoomService.findRoom(roomId);
    if (!room) {
      throw new WsException(`Room not found: ${roomId}`);
    }

    const isMember = await this.chatRoomService.isParticipant(roomId, userId);
    if (!isMember) {
      throw new WsException('Not a member of this room');
    }

    await client.join(roomId);
    this.logger.log(`User ${userId} joined room ${roomId}`);

    client.to(roomId).emit('userJoined', { roomId, userId, joinedAt: new Date().toISOString() });
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ): Promise<void> {
    const { roomId, userId } = payload;

    await client.leave(roomId);
    this.logger.log(`User ${userId} left room ${roomId}`);

    client.to(roomId).emit('userLeft', { roomId, userId, leftAt: new Date().toISOString() });
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ): Promise<void> {
    const { roomId, userId, content } = payload;

    if (!content?.trim()) {
      throw new WsException('Message content cannot be empty');
    }

    const room = await this.chatRoomService.findRoom(roomId);
    if (!room) {
      throw new WsException(`Room not found: ${roomId}`);
    }

    const isMember = await this.chatRoomService.isParticipant(roomId, userId);
    if (!isMember) {
      throw new WsException('Not a member of this room');
    }

    const message = await this.chatRoomService.saveMessage(roomId, userId, content);

    this.server.to(roomId).emit('message', {
      id: message.id,
      roomId,
      userId,
      content: message.content,
      sentAt: message.sentAt.toISOString(),
    });
  }
}
