import { Controller, Get, Param, ParseIntPipe, Query, Request } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { ClientTicketsQueryDto } from './dto/client-tickets.dto';
import { ClientTicketsService } from './client-tickets.service';

// Espace client : LECTURE SEULE. Uniquement des routes GET — aucune route d'écriture n'existe ici,
// et tout le reste de l'API refuse le rôle client (RolesGuard, refus par défaut).
@Roles(UserAuthority.CLIENT)
@Controller('client/tickets')
export class ClientTicketsController {
  constructor(private readonly service: ClientTicketsService) {}

  @Get()
  list(@Request() req: { user: { userId: number } }, @Query() query: ClientTicketsQueryDto) {
    return this.service.list(Number(req.user.userId), query);
  }

  @Get(':id')
  detail(@Request() req: { user: { userId: number } }, @Param('id', ParseIntPipe) id: number) {
    return this.service.detail(Number(req.user.userId), id);
  }
}
