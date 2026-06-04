import { setupTracing } from '@app/common';

const sdk = setupTracing('admin-api');

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AdminApiModule } from './admin-api.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(AdminApiModule);
  app.use(helmet());

  const config = new DocumentBuilder()
    .setTitle('메시징 관리자 API')
    .setDescription('클라이언트, API Key, 운영 기능 관리를 위한 관리자 API')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(async (err) => {
  console.error(err);
  await sdk.shutdown();
  process.exit(1);
});
