import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { MailSettingsService } from './mail-settings.service';

export class SaveMailSettingsDto {
  @IsEmail()
  @MaxLength(190)
  gmail: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  appName: string;

  @IsString()
  @MinLength(16)
  @MaxLength(40)
  appPassword: string;
}

// Paramètres mail : réservés au PMO. Les réponses ne contiennent jamais le mot de passe.
@Controller('settings/mail')
@Roles(UserAuthority.PMO)
export class MailSettingsController {
  constructor(private readonly settings: MailSettingsService) {}

  @Get()
  status() {
    return this.settings.status();
  }

  @Put()
  save(@Body() dto: SaveMailSettingsDto, @CurrentUser() me: { userId: number }) {
    return this.settings.save(dto, me.userId);
  }

  // Envoie un email de test à l'adresse du PMO connecté.
  @HttpCode(200)
  @Post('test')
  test(@CurrentUser() me: { email: string }) {
    return this.settings.sendTest(me.email);
  }
}
