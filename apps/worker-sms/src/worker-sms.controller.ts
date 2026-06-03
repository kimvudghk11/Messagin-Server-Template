import { Controller } from '@nestjs/common';
import { BaseWorkerController } from '@app/kafka';

@Controller()
export class WorkerSmsController extends BaseWorkerController {}
