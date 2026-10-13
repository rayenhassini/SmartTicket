import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateEquipmentDto {
  @IsString()
  sn: string;

  @IsString()
  nomPiece: string;

  @IsOptional()
  @IsBoolean()
  valid?: boolean;

  @IsOptional()
  @IsBoolean()
  reminderSent60?: boolean;

  @IsDateString()
  startDateContract: string;

  @IsDateString()
  endDateContract: string;
}
