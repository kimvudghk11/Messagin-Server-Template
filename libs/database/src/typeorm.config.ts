import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function createTypeOrmConfig(
  entities: NonNullable<TypeOrmModuleOptions['entities']>,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'messaging',
    entities,
    synchronize: false,
    logging: false,
  };
}
