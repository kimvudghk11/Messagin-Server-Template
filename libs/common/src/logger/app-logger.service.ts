import { ConsoleLogger, Injectable, Optional, Scope } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AppClsStore } from './request-id.cls';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends ConsoleLogger {
  constructor(
    @Optional() private readonly cls?: ClsService<AppClsStore>,
  ) {
    super();
  }

  private get requestId(): string {
    try {
      return this.cls?.get('requestId') ?? '-';
    } catch {
      return '-';
    }
  }

  private tag(message: unknown): string {
    return `[req:${this.requestId}] ${String(message)}`;
  }

  override log(message: unknown, ...args: unknown[]): void {
    super.log(this.tag(message), ...args);
  }

  override warn(message: unknown, ...args: unknown[]): void {
    super.warn(this.tag(message), ...args);
  }

  override error(message: unknown, ...args: unknown[]): void {
    super.error(this.tag(message), ...args);
  }

  override debug(message: unknown, ...args: unknown[]): void {
    super.debug(this.tag(message), ...args);
  }

  override verbose(message: unknown, ...args: unknown[]): void {
    super.verbose(this.tag(message), ...args);
  }
}
