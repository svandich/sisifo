import 'reflect-metadata';
import { mkdirSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  mkdirSync('./data', { recursive: true });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  app.enableShutdownHooks();
  new Logger('Bootstrap').log('Entrenador Sisifo is running');
}

bootstrap().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
