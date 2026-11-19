import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailSettingsController } from './mail-settings.controller';
import { MailSettingsService } from './mail-settings.service';
import { MailService } from './mail.service';
import { MailSettings } from './entities/mail-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MailSettings])],
  controllers: [MailSettingsController],
  providers: [MailService, MailSettingsService],
  exports: [MailService],
})
export class MailModule {}
