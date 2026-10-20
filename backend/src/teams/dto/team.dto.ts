import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTeamDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class UpdateTeamDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class AddMemberDto {
  @IsInt()
  @Min(1)
  userId: number;
}

export class TransferMemberDto {
  @IsInt()
  @Min(1)
  targetTeamId: number;
}

export class SetLeaderDto {
  @IsInt()
  @Min(1)
  userId: number;
}
