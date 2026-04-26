import { ChannelType, MessagePriority } from '@app/database';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ReceiverDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  receiverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  kakaoPhoneNumber?: string;
}

export class SendMessageRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  requestId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  templateCode!: string;

  @IsEnum(ChannelType)
  channel!: ChannelType;

  @IsObject()
  receiver!: ReceiverDto;

  @IsObject()
  variables!: Record<string, unknown>;

  @IsOptional()
  @IsEnum(MessagePriority)
  priority?: MessagePriority;

  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
