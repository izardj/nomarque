import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NomesController } from './nomes.controller';
import { NomesRepository } from './nomes.repository';
import { NomesService } from './nomes.service';

@Module({
  imports: [AuthModule],
  controllers: [NomesController],
  providers: [NomesService, NomesRepository],
  exports: [NomesRepository],
})
export class NomesModule {}
