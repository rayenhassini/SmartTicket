import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class LinkTechnicianDto {
  @IsInt()
  technicianId: number;

  @IsOptional()
  @IsBoolean()
  teamLeader?: boolean;
}
