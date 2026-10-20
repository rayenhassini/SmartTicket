import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeSupport } from './entities/type-support.entity';
import { CreateTypeSupportDto } from './dto/create-type-support.dto';
import { UpdateTypeSupportDto } from './dto/update-type-support.dto';

@Injectable()
export class TypeSupportsService {
  constructor(
    @InjectRepository(TypeSupport)
    private readonly repository: Repository<TypeSupport>,
  ) {}

  create(dto: CreateTypeSupportDto): Promise<TypeSupport> {
    const entity = this.repository.create({ ...dto, creationDate: new Date() });
    return this.repository.save(entity);
  }

  findAll(): Promise<TypeSupport[]> {
    return this.repository.find();
  }

  async findOne(id: number): Promise<TypeSupport> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`TypeSupport ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateTypeSupportDto): Promise<TypeSupport> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repository.save(entity);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
  }
}
