import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Team } from './team.entity';

// Table `team_members` (migration 001). UNIQUE(user_id) : un technicien = une seule équipe.
// joined_at (précision ms) = date d'entrée dans l'équipe, base de l'ancienneté.
@Entity('team_members')
export class TeamMember {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'team_id', type: 'bigint', unsigned: true })
  teamId: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: number;

  @Column({ name: 'joined_at', type: 'datetime', precision: 3 })
  joinedAt: Date;

  @ManyToOne(() => Team, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'team_id' })
  team?: Team;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
