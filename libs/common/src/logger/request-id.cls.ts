import { ClsService } from 'nestjs-cls';

export const REQUEST_ID_CLS_KEY = 'requestId';

export type AppClsStore = {
  requestId: string;
};

export type AppClsService = ClsService<AppClsStore>;
