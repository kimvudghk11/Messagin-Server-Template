import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

@Injectable()
export class PayloadCryptoService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const raw = this.configService.get<string>('PAYLOAD_ENCRYPTION_KEY');
    if (!raw) throw new Error('PAYLOAD_ENCRYPTION_KEY is not set');
    this.key = Buffer.from(raw, 'base64');
    if (this.key.length !== 32) {
      throw new Error('PAYLOAD_ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
    }
  }

  encrypt(data: Record<string, unknown>): Record<string, unknown> {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final(),
    ]);
    return {
      _enc: encrypted.toString('base64'),
      _iv: iv.toString('base64'),
      _tag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(envelope: Record<string, unknown>): Record<string, unknown> {
    const enc = envelope['_enc'];
    const iv = envelope['_iv'];
    const tag = envelope['_tag'];
    if (typeof enc !== 'string' || typeof iv !== 'string' || typeof tag !== 'string') {
      throw new Error('Invalid encryption envelope');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(enc, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8')) as Record<string, unknown>;
  }

  isEncrypted(data: Record<string, unknown>): boolean {
    return '_enc' in data;
  }

  mask(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = this.maskValue(key.toLowerCase(), value);
    }
    return result;
  }

  private maskValue(key: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return this.mask(value as Record<string, unknown>);
    }
    if (typeof value !== 'string') return value;
    if (key.includes('email')) return this.maskEmail(value);
    if (key.includes('phone')) return this.maskPhone(value);
    if (key.includes('name')) return this.maskName(value);
    return this.maskGeneric(value);
  }

  private maskEmail(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex < 0) return this.maskGeneric(email);
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex);
    const keep = Math.min(2, Math.max(1, local.length - 1));
    return `${local.slice(0, keep)}***${domain}`;
  }

  private maskPhone(phone: string): string {
    return phone.replace(/\d(?=(?:\D*\d){4})/g, '*');
  }

  private maskName(value: string): string {
    return `${value.slice(0, 2)}***`;
  }

  private maskGeneric(value: string): string {
    const keep = Math.max(1, Math.ceil(value.length / 3));
    return `${value.slice(0, keep)}***`;
  }
}
