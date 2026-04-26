import { ApiKeyType } from '@app/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ApiKeyEnvironment {
  LIVE = 'LIVE',
  TEST = 'TEST',
}

export class CreateClientApiKeyDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  keyName!: string;

  @ApiPropertyOptional({ enum: ApiKeyType })
  @IsOptional()
  @IsEnum(ApiKeyType)
  keyType?: ApiKeyType;

  @ApiPropertyOptional({ enum: ApiKeyEnvironment, description: 'Prefix source: LIVE -> mst_live_, TEST -> mst_test_' })
  @IsOptional()
  @IsEnum(ApiKeyEnvironment)
  environment?: ApiKeyEnvironment;

  @ApiPropertyOptional({ description: 'ISO datetime string' })
  @IsOptional()
  @IsDateString()
  expiredAt?: string;
}
