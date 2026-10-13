import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EquipmentSoft } from './equipment-soft.entity';
import { TypeSupport } from '../../type-supports/entities/type-support.entity';

@Entity('equipmentsoft_type_supports')
export class EquipmentSoftTypeSupport {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'support_id', length: 150 })
  supportId: string;

  @Column({ name: 'start_date_support', type: 'date', nullable: true })
  startDateSupport?: string;

  @Column({ name: 'end_date_support', type: 'date', nullable: true })
  endDateSupport?: string;

  @ManyToOne(() => EquipmentSoft, (equipmentSoft) => equipmentSoft.typeSupportLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipmentsoft_id' })
  equipmentSoft: EquipmentSoft;

  @ManyToOne(() => TypeSupport, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'type_support_id' })
  typeSupport: TypeSupport;
}
