import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentSoft } from './entities/equipment-soft.entity';
import { EquipmentSoftTypeSupport } from './entities/equipmentsoft-type-support.entity';
import { CreateEquipmentSoftDto } from './dto/create-equipment-soft.dto';
import { UpdateEquipmentSoftDto } from './dto/update-equipment-soft.dto';
import { LinkTypeSupportDto } from './dto/link-type-support.dto';

@Injectable()
export class EquipmentSoftsService {
  constructor(
    @InjectRepository(EquipmentSoft)
    private readonly repository: Repository<EquipmentSoft>,
    @InjectRepository(EquipmentSoftTypeSupport)
    private readonly linkRepository: Repository<EquipmentSoftTypeSupport>,
  ) {}

  create(dto: CreateEquipmentSoftDto): Promise<EquipmentSoft> {
    const entity = this.repository.create(dto);
    return this.repository.save(entity);
  }

  findAll(): Promise<EquipmentSoft[]> {
    return this.repository.find({ relations: ['typeSupportLinks'] });
  }

  async findOne(id: number): Promise<EquipmentSoft> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: ['typeSupportLinks'],
    });
    if (!entity) {
      throw new NotFoundException(`EquipmentSoft ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateEquipmentSoftDto): Promise<EquipmentSoft> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repository.save(entity);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
  }

  async linkTypeSupport(
    equipmentSoftId: number,
    dto: LinkTypeSupportDto,
  ): Promise<EquipmentSoftTypeSupport> {
    const equipmentSoft = await this.findOne(equipmentSoftId);
    const link = this.linkRepository.create({
      equipmentSoft,
      typeSupport: { id: dto.typeSupportId } as any,
      supportId: dto.supportId,
      startDateSupport: dto.startDateSupport,
      endDateSupport: dto.endDateSupport,
    });
    return this.linkRepository.save(link);
  }

  async unlinkTypeSupport(equipmentSoftId: number, linkId: number): Promise<void> {
    const link = await this.linkRepository.findOne({
      where: { id: linkId, equipmentSoft: { id: equipmentSoftId } },
      relations: ['equipmentSoft'],
    });
    if (!link) {
      throw new NotFoundException(
        `Lien TypeSupport ${linkId} introuvable pour l'equipmentsoft ${equipmentSoftId}.`,
      );
    }
    await this.linkRepository.remove(link);
  }
}
