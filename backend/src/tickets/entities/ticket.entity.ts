import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TicketStatus } from '../../common/enums/ticket-status.enum';
import { Team } from '../../teams/entities/team.entity';
import { Solution } from '../../solutions/entities/solution.entity';
import { User } from '../../users/entities/user.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Site } from '../../sites/entities/site.entity';
import { EquipmentSoft } from '../../equipment-softs/entities/equipment-soft.entity';
import { Equipment } from '../../equipment/entities/equipment.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ length: 100, unique: true })
  number: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.NOT_ASSIGNED })
  status: TicketStatus;

  @Column({ name: 'is_expired', default: false })
  isExpired: boolean;

  @Column({ name: 'is_helpdesk', default: false })
  isHelpdesk: boolean;

  @Column({ name: 'has_active_intervention', default: false })
  hasActiveIntervention: boolean;

  @Column({ name: 'internal_task', default: false })
  internalTask: boolean;

  @Column({ name: 'reminder_sent', default: false })
  reminderSent: boolean;

  @Column({ name: 'creation_date', type: 'datetime' })
  creationDate: Date;

  @Column({ name: 'resolved_date', type: 'datetime', nullable: true })
  resolvedDate?: Date;

  @Column({ name: 'assigned_date', type: 'datetime', nullable: true })
  assignedDate?: Date;

  @Column({ name: 'taken_date', type: 'datetime', nullable: true })
  takenDate?: Date;

  @Column({ name: 'closed_date', type: 'datetime', nullable: true })
  closedDate?: Date;

  @Column({ name: 'case_id', length: 100, nullable: true })
  caseId?: string;

  // Migration 003 : un ticket est assigné à UNE équipe (tous ses membres le voient).
  // NULL = pas encore assigné à une équipe. RESTRICT : une équipe qui porte des tickets ne se supprime pas.
  @Column({ name: 'team_id', type: 'bigint', unsigned: true, nullable: true })
  teamId?: number | null;

  @ManyToOne(() => Team, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'team_id' })
  team?: Team | null;

  @ManyToOne(() => Solution, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'solution_id' })
  solution?: Solution;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'client_id' })
  client?: User;

  @ManyToOne(() => Contract, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract;

  @ManyToOne(() => Site, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'site_id' })
  site?: Site;

  @ManyToOne(() => EquipmentSoft, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'equipment_soft_id' })
  equipmentSoft?: EquipmentSoft;

  @ManyToOne(() => Equipment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'equipment_hard_id' })
  equipment?: Equipment;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supervisor_id' })
  supervisor?: User;

  // Ticket <-> Technicien(s) assignés (Ticket.technicienId[] en Mongo) —
  // pure pivot, aucune colonne propre -> @ManyToMany + @JoinTable.
  @ManyToMany(() => User)
  @JoinTable({
    name: 'ticket_technicians',
    joinColumn: { name: 'ticket_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  technicians: User[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
