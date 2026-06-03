import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ClientAuthService } from '../modules/auth/client-auth.service';
import { AuthenticatedClient } from '../modules/auth/client-auth.service';

export interface RequestWithClient extends Request {
  client: AuthenticatedClient;
}

@Injectable()
export class ClientAuthGuard implements CanActivate {
  constructor(private readonly clientAuthService: ClientAuthService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithClient>();
    request.client = await this.clientAuthService.authenticate(request);
    return true;
  }
}
