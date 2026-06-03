import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientPermissionEntity, ClientPermissionType } from '@app/database';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { RequestWithClient } from './client-auth.guard';

@Injectable()
export class ClientPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(ClientPermissionEntity)
    private readonly permissionRepository: Repository<ClientPermissionEntity>,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<ClientPermissionType>(PERMISSION_KEY, context.getHandler());
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithClient>();
    const { clientAppId } = request.client;

    const permission = await this.permissionRepository.findOne({
      where: { clientAppId, permissionType: required, isAllowed: true },
    });

    if (!permission) {
      throw new ForbiddenException(`Permission denied: ${required}`);
    }

    return true;
  }
}
