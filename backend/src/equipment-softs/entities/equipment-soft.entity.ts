import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EquipmentSoftTypeSupport } from './equipmentsoft-type-support.entity';

@Entity('equipmentsofts')
export class EquipmentSoft {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'equipment_name', length: 150 })
  equipmentName: string;

  @Column({ length: 100, nullable: true })
  version?: string;

  @Column({ length: 150, nullable: true })
  constructure?: string;

  @Column({ default: true })
  valid: boolean;

  @Column({ name: 'reminder_sent_60', default: false })
  reminderSent60: boolean;

  @Column({ name: 'start_date_contract', type: 'date' })
  startDateContract: string;

  @Column({ name: 'end_date_contract', type: 'date' })
  endDateContract: string;

  @OneToMany(() => EquipmentSoftTypeSupport, (link) => link.equipmentSoft)
  typeSupportLinks: EquipmentSoftTypeSupport[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
