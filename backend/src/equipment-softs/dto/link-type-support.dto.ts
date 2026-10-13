import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class LinkTypeSupportDto {
  @IsInt()
  typeSupportId: number;

  @IsString()
  supportId: string;

  @IsOptional()
  @IsDateString()
  startDateSupport?: string;

  @IsOptional()
  @IsDateString()
  endDateSupport?: string;
}
