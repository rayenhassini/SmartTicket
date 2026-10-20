import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { TeamLeaderEvent } from './entities/team-leader-event.entity';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamNotifierService } from './team-notifier.service';

// TeamsModule n'importe PAS UsersModule (UsersModule importe TeamsModule : pas de cycle).
@Module({
  imports: [TypeOrmModule.forFeature([Team, TeamMember, TeamLeaderEvent, User])],
  controllers: [TeamsController],
  providers: [TeamsService, TeamNotifierService],
  exports: [TeamsService],
})
export class TeamsModule {}
