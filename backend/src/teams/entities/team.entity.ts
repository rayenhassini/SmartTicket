import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Table `teams` (migration 001). leader_id est NULL tant que l'équipe est vide.
// Le responsable DOIT être membre de l'équipe : garanti par TeamsService (transaction).
// NB : les ids BIGINT arrivent en string depuis mysql2 — toujours comparer via String().
@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ name: 'leader_id', type: 'bigint', unsigned: true, nullable: true })
  leaderId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leader_id' })
  leader?: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
