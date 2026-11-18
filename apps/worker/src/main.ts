import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  // Fail fast on a missing variable, before anything connects.
  loadEnv();
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  Logger.log('Worker started');
}

void bootstrap();
