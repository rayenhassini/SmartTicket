import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateEquipmentSoftDto {
  @IsString()
  equipmentName: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  constructure?: string;

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
