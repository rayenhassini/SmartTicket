import { IsInt } from 'class-validator';

export class SetSupervisorDto {
  @IsInt()
  supervisorId: number;
}
