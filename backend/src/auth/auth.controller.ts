import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { BootstrapUserDto } from './dto/bootstrap-user.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // LocalAuthGuard valide email/password via LocalStrategy puis attache
  // l'utilisateur authentifié à req.user avant d'arriver ici.
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Body() _dto: LoginDto, @Request() req: any) {
    return this.authService.login(req.user);
  }

  // Volontairement SANS JwtAuthGuard : il n'existe encore aucun token tant
  // que la table `users` est vide. Ne fonctionne qu'une seule fois (voir
  // AuthService.bootstrap — refuse avec 409 dès qu'un user existe déjà).
  // Ne remplace pas POST /users, qui reste protégé par JWT en permanence.
  @Post('bootstrap')
  bootstrap(@Body() dto: BootstrapUserDto) {
    return this.authService.bootstrap(dto);
  }
}
