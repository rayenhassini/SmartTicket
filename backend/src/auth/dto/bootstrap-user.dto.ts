import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

// Rôles autorisés pour le tout premier compte créé via /auth/bootstrap.
// Volontairement restreint (pas de 'client'/'technician'/etc via ce canal) :
// le bootstrap sert uniquement à amorcer un compte d'administration/pilotage.
export enum BootstrapAuthority {
  PMO = 'pmo',
  ASSISTANT = 'assistant',
}

export class BootstrapUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsEnum(BootstrapAuthority)
  authority?: BootstrapAuthority;
}
