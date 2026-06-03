import { SetMetadata } from '@nestjs/common';
import { ClientPermissionType } from '@app/database';

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (permission: ClientPermissionType) =>
  SetMetadata(PERMISSION_KEY, permission);
