import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketStatus } from '../../common/enums/ticket-status.enum';

export class CreateTicketDto {
  @IsString()
  number: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsBoolean()
  isHelpdesk?: boolean;

  @IsOptional()
  @IsBoolean()
  internalTask?: boolean;

  @IsOptional()
  @IsString()
  caseId?: string;

  @IsOptional()
  @IsInt()
  clientId?: number;

  @IsOptional()
  @IsInt()
  contractId?: number;

  @IsOptional()
  @IsInt()
  siteId?: number;

  @IsOptional()
  @IsInt()
  equipmentId?: number;

  @IsOptional()
  @IsInt()
  equipmentSoftId?: number;

  @IsOptional()
  @IsInt()
  supervisorId?: number;

  @IsOptional()
  @IsInt()
  solutionId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  technicianIds?: number[];
}
