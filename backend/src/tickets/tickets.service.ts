import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../teams/entities/team.entity';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { Ticket } from './entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Solution } from '../solutions/entities/solution.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Site } from '../sites/entities/site.entity';
import { Equipment } from '../equipment/entities/equipment.entity';
import { EquipmentSoft } from '../equipment-softs/entities/equipment-soft.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AssignTechnicianDto } from './dto/assign-technicians.dto';
import { SetSupervisorDto } from './dto/set-supervisor.dto';
import { LinkSolutionDto } from './dto/link-solution.dto';

export const TICKET_RELATIONS = [
  'team',
  'solution',
  'client',
  'contract',
  'site',
  'equipment',
  'equipmentSoft',
  'supervisor',
  'technicians',
];

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateTicketDto): Promise<Ticket> {
    const {
      clientId,
      contractId,
      siteId,
      equipmentId,
      equipmentSoftId,
      supervisorId,
      solutionId,
      technicianIds,
      ...rest
    } = dto;

    const entity = this.ticketsRepository.create({
      ...rest,
      creationDate: new Date(),
      client: clientId ? ({ id: clientId } as User) : undefined,
      contract: contractId ? ({ id: contractId } as Contract) : undefined,
      site: siteId ? ({ id: siteId } as Site) : undefined,
      equipment: equipmentId ? ({ id: equipmentId } as Equipment) : undefined,
      equipmentSoft: equipmentSoftId
        ? ({ id: equipmentSoftId } as EquipmentSoft)
        : undefined,
      supervisor: supervisorId ? ({ id: supervisorId } as User) : undefined,
      solution: solutionId ? ({ id: solutionId } as Solution) : undefined,
      technicians: technicianIds
        ? technicianIds.map((id) => ({ id } as User))
        : [],
    });

    return this.ticketsRepository.save(entity);
  }

  findAll(): Promise<Ticket[]> {
    return this.ticketsRepository.find({ relations: TICKET_RELATIONS });
  }

  async findOne(id: number): Promise<Ticket> {
    const entity = await this.ticketsRepository.findOne({
      where: { id },
      relations: TICKET_RELATIONS,
    });
    if (!entity) {
      throw new NotFoundException(`Ticket ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateTicketDto): Promise<Ticket> {
    const entity = await this.findOne(id);
    const {
      clientId,
      contractId,
      siteId,
      equipmentId,
      equipmentSoftId,
      supervisorId,
      solutionId,
      technicianIds,
      ...rest
    } = dto;

    Object.assign(entity, rest);
    if (clientId !== undefined) entity.client = clientId ? ({ id: clientId } as User) : undefined;
    if (contractId !== undefined)
      entity.contract = contractId ? ({ id: contractId } as Contract) : undefined;
    if (siteId !== undefined) entity.site = siteId ? ({ id: siteId } as Site) : undefined;
    if (equipmentId !== undefined)
      entity.equipment = equipmentId ? ({ id: equipmentId } as Equipment) : undefined;
    if (equipmentSoftId !== undefined)
      entity.equipmentSoft = equipmentSoftId
        ? ({ id: equipmentSoftId } as EquipmentSoft)
        : undefined;
    if (supervisorId !== undefined)
      entity.supervisor = supervisorId ? ({ id: supervisorId } as User) : undefined;
    if (solutionId !== undefined)
      entity.solution = solutionId ? ({ id: solutionId } as Solution) : undefined;
    if (technicianIds !== undefined) {
      entity.technicians = technicianIds.map((tid) => ({ id: tid } as User));
    }

    return this.ticketsRepository.save(entity);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.ticketsRepository.remove(entity);
  }

  async updateStatus(id: number, dto: UpdateTicketStatusDto): Promise<Ticket> {
    const entity = await this.findOne(id);
    entity.status = dto.status;
    // Dates de cycle de vie : posées une seule fois (jamais écrasées), sans autre effet.
    const now = new Date();
    if (dto.status === TicketStatus.ASSIGNED && !entity.assignedDate) entity.assignedDate = now;
    if (dto.status === TicketStatus.IN_PROGRESS && !entity.takenDate) entity.takenDate = now;
    if (dto.status === TicketStatus.RESOLVED && !entity.resolvedDate) entity.resolvedDate = now;
    if (dto.status === TicketStatus.CLOSED && !entity.closedDate) entity.closedDate = now;
    return this.ticketsRepository.save(entity);
  }

  // PMO : assigne le ticket à UNE équipe complète (tous ses membres le voient). Un ticket « Not Assigned »
  // passe à « Assigned ». Le changement d'équipe est refusé une fois le ticket Resolved / Closed / Deleted.
  async assignTeam(id: number, teamId: number): Promise<Ticket> {
    const entity = await this.findOne(id);
    const team = await this.ticketsRepository.manager.findOne(Team, { where: { id: teamId } });
    if (!team) throw new NotFoundException(`Équipe ${teamId} introuvable.`);
    if (String(entity.teamId ?? '') === String(team.id)) return entity;
    if ([TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.DELETED].includes(entity.status)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'TICKET_NOT_REASSIGNABLE',
        message: `Impossible de changer l'équipe d'un ticket au statut « ${entity.status} ».`,
      });
    }
    entity.team = team;
    entity.teamId = team.id;
    if (entity.status === TicketStatus.NOT_ASSIGNED) {
      entity.status = TicketStatus.ASSIGNED;
      if (!entity.assignedDate) entity.assignedDate = new Date();
    }
    await this.ticketsRepository.save(entity);
    return this.findOne(id);
  }

  async assignTechnician(id: number, dto: AssignTechnicianDto): Promise<Ticket> {
    const entity = await this.findOne(id);
    const technician = await this.usersRepository.findOne({
      where: { id: dto.technicianId },
    });
    if (!technician) {
      throw new NotFoundException(`User ${dto.technicianId} introuvable.`);
    }
    const already = (entity.technicians ?? []).some((t) => t.id === technician.id);
    if (!already) {
      entity.technicians = [...(entity.technicians ?? []), technician];
      await this.ticketsRepository.save(entity);
    }
    return entity;
  }

  async removeTechnician(id: number, technicianId: number): Promise<Ticket> {
    const entity = await this.findOne(id);
    // BIGINT : mysql2 renvoie les ids en string, alors que technicianId vient
    // d'un ParseIntPipe (number). Comparer en string, jamais avec !== direct.
    entity.technicians = (entity.technicians ?? []).filter(
      (t) => String(t.id) !== String(technicianId),
    );
    return this.ticketsRepository.save(entity);
  }

  async setSupervisor(id: number, dto: SetSupervisorDto): Promise<Ticket> {
    const entity = await this.findOne(id);
    entity.supervisor = { id: dto.supervisorId } as User;
    return this.ticketsRepository.save(entity);
  }

  async linkSolution(id: number, dto: LinkSolutionDto): Promise<Ticket> {
    const entity = await this.findOne(id);
    entity.solution = { id: dto.solutionId } as Solution;
    return this.ticketsRepository.save(entity);
  }
}
