import { ChannelType, ProviderType } from '@app/database';
import { BaseWorkerService } from '@app/kafka';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkerEmailService extends BaseWorkerService {
  protected readonly channelType = ChannelType.EMAIL;
  protected readonly kafkaClientIdEnvKey = 'KAFKA_WORKER_EMAIL_CLIENT_ID';
  protected readonly kafkaClientIdDefault = 'worker-email';
  protected readonly kafkaGroupIdEnvKey = 'KAFKA_WORKER_EMAIL_GROUP_ID';
  protected readonly kafkaGroupIdDefault = 'worker-email-group';
  protected readonly providerType = ProviderType.AWS_SES;
  protected readonly errorCode = 'EMAIL_SEND_FAILED';
}
