import { ApiKeyType } from '@app/database';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ApiKeyEnvironment {
  LIVE = 'LIVE',
  TEST = 'TEST',
}

export class CreateClientApiKeyDto {
  @IsString()
  @MaxLength(120)
  keyName!: string;

  @IsOptional()
  @IsEnum(ApiKeyType)
  keyType?: ApiKeyType;

  @IsOptional()
  @IsEnum(ApiKeyEnvironment)
  environment?: ApiKeyEnvironment;

  @IsOptional()
  @IsDateString()
  expiredAt?: string;
}
