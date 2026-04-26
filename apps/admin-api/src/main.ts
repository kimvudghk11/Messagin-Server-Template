import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AdminApiModule } from './admin-api.module';

async function bootstrap() {
  const app = await NestFactory.create(AdminApiModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
