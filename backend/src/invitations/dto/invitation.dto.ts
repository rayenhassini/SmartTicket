import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class CreateInvitationDto {
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(190)
  email: string;

  // Obligatoire : une invitation technicien est toujours rattachée à une équipe.
  @IsInt()
  @Min(1)
  teamId: number;
}

export class ListInvitationsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'accepted', 'expired', 'cancelled'])
  status?: 'pending' | 'accepted' | 'expired' | 'cancelled';
}

// Corps de l'acceptation (route publique) : le strict nécessaire pour créer le compte.
// L'email, le rôle et l'équipe viennent de l'invitation — jamais du client.
export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;
}
