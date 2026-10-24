import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class ForgotPasswordDto {
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(190)
  email: string;
}

// Seuls le jeton et le mot de passe sont acceptés (whitelist + forbidNonWhitelisted) :
// impossible de transmettre un rôle, un nom ou un email.
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MaxLength(128)
  passwordConfirm: string;
}
