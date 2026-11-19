import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/entities/user.entity';
import { PmoResignation } from './entities/pmo-resignation.entity';
import { PmoSuccessionController } from './pmo-succession.controller';
import { PmoSuccessionService } from './pmo-succession.service';

@Module({
  imports: [TypeOrmModule.forFeature([PmoResignation, User]), AuthModule, MailModule],
  controllers: [PmoSuccessionController],
  providers: [PmoSuccessionService],
})
export class PmoSuccessionModule {}
