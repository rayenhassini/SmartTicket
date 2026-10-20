import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AssignTechnicianDto } from './dto/assign-technicians.dto';
import { SetSupervisorDto } from './dto/set-supervisor.dto';
import { LinkSolutionDto } from './dto/link-solution.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserAuthority } from '../common/enums/user-authority.enum';

@Roles(UserAuthority.PMO)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  @Post()
  create(@Body() dto: CreateTicketDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTicketDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }

  @Post(':id/technicians')
  assignTechnician(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignTechnicianDto,
  ) {
    return this.service.assignTechnician(id, dto);
  }

  @Delete(':id/technicians/:userId')
  removeTechnician(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.service.removeTechnician(id, userId);
  }

  @Patch(':id/supervisor')
  setSupervisor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetSupervisorDto,
  ) {
    return this.service.setSupervisor(id, dto);
  }

  @Patch(':id/solution')
  linkSolution(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkSolutionDto,
  ) {
    return this.service.linkSolution(id, dto);
  }
}
