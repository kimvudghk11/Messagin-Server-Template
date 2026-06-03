import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { AppClsStore, REQUEST_ID_CLS_KEY } from '../logger/request-id.cls';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(
    @Optional() private readonly cls?: ClsService<AppClsStore>,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? randomUUID();
    req.headers[REQUEST_ID_HEADER] = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    this.cls?.set(REQUEST_ID_CLS_KEY, id);
    next();
  }
}
