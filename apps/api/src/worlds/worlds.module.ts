import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NomesModule } from '../nomes/nomes.module';
import { WorldsController } from './worlds.controller';
import { WorldsService } from './worlds.service';

@Module({
  imports: [AuthModule, NomesModule],
  controllers: [WorldsController],
  providers: [WorldsService],
})
export class WorldsModule {}
