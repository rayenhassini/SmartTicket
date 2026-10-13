import { IsEnum } from 'class-validator';
import { TicketStatus } from '../../common/enums/ticket-status.enum';

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  status: TicketStatus;
}
