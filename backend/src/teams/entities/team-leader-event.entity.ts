import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Team } from './team.entity';

export enum LeaderEventReason {
  MANUAL = 'manual', // désigné par le PMO
  FIRST_MEMBER = 'first_member', // 1er membre d'une équipe vide
  AUTO_SUCCESSION = 'auto_succession', // le responsable est parti (retrait, transfert, désactivation)
}

// Table `team_leader_events` (migration 001) : historique des changements de responsable.
@Entity('team_leader_events')
export class TeamLeaderEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'team_id', type: 'bigint', unsigned: true })
  teamId: number;

  @Column({ name: 'previous_leader_id', type: 'bigint', unsigned: true, nullable: true })
  previousLeaderId: number | null;

  @Column({ name: 'new_leader_id', type: 'bigint', unsigned: true, nullable: true })
  newLeaderId: number | null;

  @Column({ type: 'enum', enum: LeaderEventReason })
  reason: LeaderEventReason;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Réservé à un futur acquittement global (bandeau PMO) — non utilisé en Phase 2.
  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date | null;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team?: Team;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'previous_leader_id' })
  previousLeader?: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'new_leader_id' })
  newLeader?: User | null;
}
