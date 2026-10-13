import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment } from './entities/equipment.entity';
import { EquipmentTypeSupport } from './entities/equipment-type-support.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { LinkTypeSupportDto } from './dto/link-type-support.dto';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    @InjectRepository(EquipmentTypeSupport)
    private readonly linkRepository: Repository<EquipmentTypeSupport>,
  ) {}

  create(dto: CreateEquipmentDto): Promise<Equipment> {
    const entity = this.equipmentRepository.create(dto);
    return this.equipmentRepository.save(entity);
  }

  findAll(): Promise<Equipment[]> {
    return this.equipmentRepository.find({ relations: ['typeSupportLinks'] });
  }

  async findOne(id: number): Promise<Equipment> {
    const entity = await this.equipmentRepository.findOne({
      where: { id },
      relations: ['typeSupportLinks'],
    });
    if (!entity) {
      throw new NotFoundException(`Equipment ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateEquipmentDto): Promise<Equipment> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.equipmentRepository.save(entity);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.equipmentRepository.remove(entity);
  }

  async linkTypeSupport(
    equipmentId: number,
    dto: LinkTypeSupportDto,
  ): Promise<EquipmentTypeSupport> {
    const equipment = await this.findOne(equipmentId);
    const link = this.linkRepository.create({
      equipment,
      typeSupport: { id: dto.typeSupportId } as any,
      supportId: dto.supportId,
      startDateSupport: dto.startDateSupport,
      endDateSupport: dto.endDateSupport,
    });
    return this.linkRepository.save(link);
  }

  async unlinkTypeSupport(equipmentId: number, linkId: number): Promise<void> {
    const link = await this.linkRepository.findOne({
      where: { id: linkId, equipment: { id: equipmentId } },
      relations: ['equipment'],
    });
    if (!link) {
      throw new NotFoundException(
        `Lien TypeSupport ${linkId} introuvable pour l'équipement ${equipmentId}.`,
      );
    }
    await this.linkRepository.remove(link);
  }
}
