import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { ClockModule } from '../common/clock';
import { ConfigModule } from '../config/config.module';
import { MailModule } from '../mail/mail.module';
import { NomesModule } from '../nomes/nomes.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WorldsModule } from '../worlds/worlds.module';

@Module({
  imports: [
    ConfigModule,
    ClockModule,
    PrismaModule,
    MailModule,
    // Default per-client rate limit; sensitive routes tighten it with @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    WorldsModule,
    NomesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
