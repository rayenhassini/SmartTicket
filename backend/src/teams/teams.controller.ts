import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { TeamsService } from './teams.service';
import { AddMemberDto, CreateTeamDto, SetLeaderDto, TransferMemberDto, UpdateTeamDto } from './dto/team.dto';

// Phase 2 : toutes les routes PMO, sauf GET /teams/mine (technicien : SA propre équipe).
// Les guards globaux de la Phase 1 restent actifs (JWT + refus par défaut).
@Roles(UserAuthority.PMO)
@Controller('teams')
export class TeamsController {
  constructor(private readonly service: TeamsService) {}

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.service.create(dto.name);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Doivent rester AVANT « :id » pour ne pas être pris pour un identifiant.
  @Roles(UserAuthority.TECHNICIAN)
  @Get('mine')
  findMine(@Request() req: { user: { userId: number } }) {
    return this.service.findMine(req.user.userId);
  }

  @Get('technicians')
  listTechnicians() {
    return this.service.listTechnicians();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  rename(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamDto) {
    return this.service.rename(id, dto.name);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post(':id/members')
  addMember(@Param('id', ParseIntPipe) id: number, @Body() dto: AddMemberDto) {
    return this.service.addMember(id, dto.userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(200)
  removeMember(@Param('id', ParseIntPipe) id: number, @Param('userId', ParseIntPipe) userId: number) {
    return this.service.removeMember(id, userId);
  }

  @Post(':id/members/:userId/transfer')
  @HttpCode(200)
  transferMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: TransferMemberDto,
  ) {
    return this.service.transferMember(id, userId, dto.targetTeamId);
  }

  @Patch(':id/leader')
  setLeader(@Param('id', ParseIntPipe) id: number, @Body() dto: SetLeaderDto) {
    return this.service.setLeader(id, dto.userId);
  }
}
