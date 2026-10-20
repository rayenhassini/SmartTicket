import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EquipmentTypeSupport } from './equipment-type-support.entity';

@Entity('equipment')
export class Equipment {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ length: 150, unique: true })
  sn: string;

  @Column({ name: 'nom_piece', length: 150 })
  nomPiece: string;

  @Column({ default: true })
  valid: boolean;

  @Column({ name: 'reminder_sent_60', default: false })
  reminderSent60: boolean;

  @Column({ name: 'start_date_contract', type: 'date' })
  startDateContract: string;

  @Column({ name: 'end_date_contract', type: 'date' })
  endDateContract: string;

  @OneToMany(() => EquipmentTypeSupport, (link) => link.equipment)
  typeSupportLinks: EquipmentTypeSupport[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
