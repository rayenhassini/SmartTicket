import { IsOptional, IsString } from 'class-validator';

export class CreateTypeSupportDto {
  @IsString()
  supportName: string;

  @IsString()
  supportEmail: string;

  @IsOptional()
  @IsString()
  logoPath?: string;
}
