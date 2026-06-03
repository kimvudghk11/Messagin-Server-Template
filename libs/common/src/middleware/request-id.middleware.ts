import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = req.headers[REQUEST_ID_HEADER] ?? randomUUID();
    req.headers[REQUEST_ID_HEADER] = id as string;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
