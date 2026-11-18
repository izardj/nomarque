import { Module } from '@nestjs/common';
import { ClockModule } from '../common/clock';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReignModule } from '../reign/reign.module';

@Module({
  imports: [ConfigModule, ClockModule, PrismaModule, ReignModule],
})
export class AppModule {}
