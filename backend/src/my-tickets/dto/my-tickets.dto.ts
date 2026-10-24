import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TicketStatus } from '../../common/enums/ticket-status.enum';

// Statuts que le RESPONSABLE d'équipe peut poser (spécification métier).
export const LEADER_STATUSES = [
  TicketStatus.IN_PROGRESS,
  TicketStatus.ON_HOLD,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.DELETED,
] as const;

export class LeaderStatusDto {
  @IsIn(LEADER_STATUSES as unknown as string[])
  status: TicketStatus;
}

export class LeaderSolutionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  solutionText: string;
}
