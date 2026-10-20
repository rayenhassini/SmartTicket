import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { ContractTechnician } from './entities/contract-technician.entity';
import { ContractTypeSupport } from './entities/contract-type-support.entity';
import { User } from '../users/entities/user.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { LinkClientDto } from './dto/link-client.dto';
import { LinkTechnicianDto } from './dto/link-technician.dto';
import { LinkTypeSupportDto } from './dto/link-type-support.dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractsRepository: Repository<Contract>,
    @InjectRepository(ContractTechnician)
    private readonly technicianLinkRepository: Repository<ContractTechnician>,
    @InjectRepository(ContractTypeSupport)
    private readonly typeSupportLinkRepository: Repository<ContractTypeSupport>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  create(dto: CreateContractDto): Promise<Contract> {
    const { commercialId, ...rest } = dto;
    const entity = this.contractsRepository.create({
      ...rest,
      commercial: commercialId ? ({ id: commercialId } as User) : undefined,
    });
    return this.contractsRepository.save(entity);
  }

  findAll(): Promise<Contract[]> {
    return this.contractsRepository.find({
      relations: ['commercial', 'clients', 'technicianLinks', 'typeSupportLinks'],
    });
  }

  async findOne(id: number): Promise<Contract> {
    const entity = await this.contractsRepository.findOne({
      where: { id },
      relations: [
        'commercial',
        'clients',
        'technicianLinks',
        'technicianLinks.technician',
        'typeSupportLinks',
        'typeSupportLinks.typeSupport',
      ],
    });
    if (!entity) {
      throw new NotFoundException(`Contract ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateContractDto): Promise<Contract> {
    const entity = await this.findOne(id);
    const { commercialId, ...rest } = dto;
    Object.assign(entity, rest);
    if (commercialId !== undefined) {
      entity.commercial = commercialId ? ({ id: commercialId } as User) : undefined;
    }
    return this.contractsRepository.save(entity);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.contractsRepository.remove(entity);
  }

  async linkClient(contractId: number, dto: LinkClientDto): Promise<Contract> {
    const contract = await this.findOne(contractId);
    const client = await this.usersRepository.findOne({ where: { id: dto.clientId } });
    if (!client) {
      throw new NotFoundException(`User ${dto.clientId} introuvable.`);
    }
    contract.clients = [...(contract.clients ?? []), client];
    return this.contractsRepository.save(contract);
  }

  async unlinkClient(contractId: number, clientId: number): Promise<Contract> {
    const contract = await this.findOne(contractId);
    contract.clients = (contract.clients ?? []).filter((c) => c.id !== clientId);
    return this.contractsRepository.save(contract);
  }

  async linkTechnician(
    contractId: number,
    dto: LinkTechnicianDto,
  ): Promise<ContractTechnician> {
    const contract = await this.findOne(contractId);
    const link = this.technicianLinkRepository.create({
      contract,
      technician: { id: dto.technicianId } as User,
      teamLeader: dto.teamLeader ?? false,
    });
    return this.technicianLinkRepository.save(link);
  }

  async unlinkTechnician(contractId: number, technicianId: number): Promise<void> {
    const link = await this.technicianLinkRepository.findOne({
      where: { contractId, technicianId },
    });
    if (!link) {
      throw new NotFoundException(
        `Lien technicien ${technicianId} introuvable pour le contrat ${contractId}.`,
      );
    }
    await this.technicianLinkRepository.remove(link);
  }

  async linkTypeSupport(
    contractId: number,
    dto: LinkTypeSupportDto,
  ): Promise<ContractTypeSupport> {
    const contract = await this.findOne(contractId);
    const link = this.typeSupportLinkRepository.create({
      contract,
      typeSupport: { id: dto.typeSupportId } as any,
      supportId: dto.supportId,
    });
    return this.typeSupportLinkRepository.save(link);
  }

  async unlinkTypeSupport(contractId: number, linkId: number): Promise<void> {
    const link = await this.typeSupportLinkRepository.findOne({
      where: { id: linkId, contract: { id: contractId } },
      relations: ['contract'],
    });
    if (!link) {
      throw new NotFoundException(
        `Lien TypeSupport ${linkId} introuvable pour le contrat ${contractId}.`,
      );
    }
    await this.typeSupportLinkRepository.remove(link);
  }
}
