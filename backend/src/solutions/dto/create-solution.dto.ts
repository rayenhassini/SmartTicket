import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSolutionDto {
  @IsOptional()
  @IsString()
  solutionText?: string;

  @IsOptional()
  @IsInt()
  proposedParId?: number;

  @IsOptional()
  @IsBoolean()
  valid?: boolean;
}
