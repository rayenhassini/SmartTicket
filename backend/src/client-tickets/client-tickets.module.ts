import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../tickets/entities/ticket.entity';
import { ClientTicketsController } from './client-tickets.controller';
import { ClientTicketsService } from './client-tickets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket])],
  controllers: [ClientTicketsController],
  providers: [ClientTicketsService],
})
export class ClientTicketsModule {}
