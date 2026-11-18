import { Module } from '@nestjs/common';
import { NomesRepository } from '@nomarque/nome-store';
import { AuthModule } from '../auth/auth.module';
import { NomesController } from './nomes.controller';
import { NomesService } from './nomes.service';

@Module({
  imports: [AuthModule],
  controllers: [NomesController],
  providers: [NomesService, NomesRepository],
  exports: [NomesRepository],
})
export class NomesModule {}
