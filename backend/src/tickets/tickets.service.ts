import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

const TICKET_RELATIONS = [
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
    return this.ticketsRepository.save(entity);
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
    entity.technicians = (entity.technicians ?? []).filter(
      (t) => t.id !== technicianId,
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
