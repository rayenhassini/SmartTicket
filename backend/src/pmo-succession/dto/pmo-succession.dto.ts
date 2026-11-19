import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class CreateResignationDto {
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(190)
  successorEmail: string;
}

export class ValidateSuccessionQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;
}

// L'email et le rôle (pmo) viennent de l'invitation : jamais du client (whitelist + forbidNonWhitelisted).
export class AcceptSuccessionDto {
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
