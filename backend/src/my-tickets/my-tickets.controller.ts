import { Body, Controller, Get, Param, ParseIntPipe, Patch, Put, Request } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { MyTicketsService } from './my-tickets.service';
import { LeaderSolutionDto, LeaderStatusDto } from './dto/my-tickets.dto';

type Req = { user: { userId: number } };

// Espace technicien : UNIQUEMENT le rôle technician (le PMO utilise /tickets). Le périmètre (équipe)
// et le droit d'écriture (responsable) sont vérifiés dans MyTicketsService, jamais dans l'interface.
@Roles(UserAuthority.TECHNICIAN)
@Controller('me/tickets')
export class MyTicketsController {
  constructor(private readonly service: MyTicketsService) {}

  @Get()
  list(@Request() req: Req) {
    return this.service.list(req.user.userId);
  }

  @Get(':id')
  detail(@Request() req: Req, @Param('id', ParseIntPipe) id: number) {
    return this.service.detail(req.user.userId, id);
  }

  @Patch(':id/status')
  changeStatus(@Request() req: Req, @Param('id', ParseIntPipe) id: number, @Body() dto: LeaderStatusDto) {
    return this.service.changeStatus(req.user.userId, id, dto);
  }

  @Put(':id/solution')
  saveSolution(@Request() req: Req, @Param('id', ParseIntPipe) id: number, @Body() dto: LeaderSolutionDto) {
    return this.service.saveSolution(req.user.userId, id, dto);
  }
}
