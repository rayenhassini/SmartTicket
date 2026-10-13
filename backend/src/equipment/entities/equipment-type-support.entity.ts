import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Equipment } from './equipment.entity';
import { TypeSupport } from '../../type-supports/entities/type-support.entity';

// Table de jonction `equipment_type_supports` — porte des colonnes propres
// (support_id, dates), donc entity dédiée (pas un simple @JoinTable).
@Entity('equipment_type_supports')
export class EquipmentTypeSupport {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'support_id', length: 150 })
  supportId: string;

  @Column({ name: 'start_date_support', type: 'date', nullable: true })
  startDateSupport?: string;

  @Column({ name: 'end_date_support', type: 'date', nullable: true })
  endDateSupport?: string;

  @ManyToOne(() => Equipment, (equipment) => equipment.typeSupportLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @ManyToOne(() => TypeSupport, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'type_support_id' })
  typeSupport: TypeSupport;
}
