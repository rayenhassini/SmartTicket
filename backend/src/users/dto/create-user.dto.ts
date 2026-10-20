import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserAuthority } from '../../common/enums/user-authority.enum';
import { ClientRole } from '../../common/enums/client-role.enum';

export class CreateUserDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsEnum(UserAuthority)
  authority: UserAuthority;

  @IsOptional()
  @IsString()
  imagePath?: string;

  @IsOptional()
  @IsBoolean()
  valid?: boolean;

  @IsOptional()
  @IsBoolean()
  teamLeader?: boolean;

  // Client
  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsEnum(ClientRole)
  clientRole?: ClientRole;

  @IsOptional()
  @IsString()
  about?: string;

  // Technicien
  @IsOptional()
  @IsBoolean()
  permisConduire?: boolean;

  @IsOptional()
  @IsBoolean()
  passeport?: boolean;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  expiredAt?: string;

  @IsOptional()
  @IsString()
  signaturePath?: string;
}
