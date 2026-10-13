import { IsInt } from 'class-validator';

export class LinkSolutionDto {
  @IsInt()
  solutionId: number;
}
