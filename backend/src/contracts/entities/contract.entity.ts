import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ContractTechnician } from './contract-technician.entity';
import { ContractTypeSupport } from './contract-type-support.entity';
import { ContractType } from '../../common/enums/contract-type.enum';
import { ContractNature } from '../../common/enums/contract-nature.enum';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'business_id', length: 100, unique: true })
  businessId: string;

  @Column({ type: 'enum', enum: ContractType })
  type: ContractType;

  @Column({ type: 'enum', enum: ContractNature })
  nature: ContractNature;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ length: 255 })
  sla: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: string;

  @Column({ name: 'jour_infogerance', length: 50, nullable: true })
  jourInfogerance?: string;

  @Column({ default: true })
  valid: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  montant?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'commercial_id' })
  commercial?: User;

  // Contract <-> Clients (Contract.clients[] en Mongo) — pure pivot
  @ManyToMany(() => User)
  @JoinTable({
    name: 'contract_clients',
    joinColumn: { name: 'contract_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'client_id', referencedColumnName: 'id' },
  })
  clients: User[];

  // Contract <-> Techniciens (porte team_leader) -> entity dédiée
  @OneToMany(() => ContractTechnician, (link) => link.contract)
  technicianLinks: ContractTechnician[];

  // Contract <-> TypeSupport (porte support_id) -> entity dédiée
  @OneToMany(() => ContractTypeSupport, (link) => link.contract)
  typeSupportLinks: ContractTypeSupport[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
