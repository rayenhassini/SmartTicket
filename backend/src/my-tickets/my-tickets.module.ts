import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Team } from '../teams/entities/team.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { Solution } from '../solutions/entities/solution.entity';
import { TicketsModule } from '../tickets/tickets.module';
import { MyTicketsController } from './my-tickets.controller';
import { MyTicketsService } from './my-tickets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, Team, TeamMember, Solution]), TicketsModule],
  controllers: [MyTicketsController],
  providers: [MyTicketsService],
})
export class MyTicketsModule {}
