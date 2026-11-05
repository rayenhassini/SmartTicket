import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { ClientInvitation } from './entities/client-invitation.entity';
import { ClientInvitationsController } from './client-invitations.controller';
import { ClientInvitationsService } from './client-invitations.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientInvitation, User]), AuthModule, MailModule],
  controllers: [ClientInvitationsController],
  providers: [ClientInvitationsService],
})
export class ClientInvitationsModule {}
