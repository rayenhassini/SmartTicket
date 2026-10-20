import { IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  nomSite: string;

  @IsOptional()
  @IsString()
  longitude?: string;

  @IsOptional()
  @IsString()
  latitude?: string;

  @IsString()
  adresse: string;
}
