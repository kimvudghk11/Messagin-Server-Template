import { ChannelType, ProviderType } from '@app/database';
import { BaseWorkerService } from '@app/kafka';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkerSmsService extends BaseWorkerService {
  protected readonly channelType = ChannelType.SMS;
  protected readonly kafkaClientIdEnvKey = 'KAFKA_WORKER_SMS_CLIENT_ID';
  protected readonly kafkaClientIdDefault = 'worker-sms';
  protected readonly kafkaGroupIdEnvKey = 'KAFKA_WORKER_SMS_GROUP_ID';
  protected readonly kafkaGroupIdDefault = 'worker-sms-group';
  protected readonly providerType = ProviderType.SMS_VENDOR;
  protected readonly errorCode = 'SMS_SEND_FAILED';
}
