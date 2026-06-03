import { ChannelType, ProviderType } from '@app/database';
import { BaseWorkerService } from '@app/kafka';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkerKakaoService extends BaseWorkerService {
  protected readonly channelType = ChannelType.KAKAO;
  protected readonly kafkaClientIdEnvKey = 'KAFKA_WORKER_KAKAO_CLIENT_ID';
  protected readonly kafkaClientIdDefault = 'worker-kakao';
  protected readonly kafkaGroupIdEnvKey = 'KAFKA_WORKER_KAKAO_GROUP_ID';
  protected readonly kafkaGroupIdDefault = 'worker-kakao-group';
  protected readonly providerType = ProviderType.KAKAO_VENDOR;
  protected readonly errorCode = 'KAKAO_SEND_FAILED';
}
