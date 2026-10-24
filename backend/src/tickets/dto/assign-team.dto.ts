import { IsInt, Min } from 'class-validator';

export class AssignTeamDto {
  @IsInt()
  @Min(1)
  teamId: number;
}
