import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

// Invitation client : l'email SEUL (pas d'équipe, pas de rôle : le rôle est forcé côté serveur).
export class CreateClientInvitationDto {
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(190)
  email: string;
}

export class ListClientInvitationsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'accepted', 'expired', 'cancelled'])
  status?: 'pending' | 'accepted' | 'expired' | 'cancelled';
}

export class ValidateClientInvitationQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;
}

// Corps de l'acceptation (route publique). L'email, le rôle (client) et client_role (clientUser)
// viennent de l'invitation / du serveur — jamais du client (whitelist + forbidNonWhitelisted).
export class AcceptClientInvitationDto {
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

  // Texte libre (pas de format imposé en Phase 4), obligatoire.
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phoneNumber: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  location: string;

  // Facultatif.
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  company?: string;
}
