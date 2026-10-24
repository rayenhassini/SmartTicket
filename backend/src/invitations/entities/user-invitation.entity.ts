import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { User } from '../../users/entities/user.entity';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

// Table `user_invitations` (migration 002). Phase 3 : technicien uniquement.
// `token` contient le HASH SHA-256 du jeton (le jeton en clair n'est que dans le lien du mail).
// La colonne générée `pending_email` (unicité d'une seule invitation pending par email) est
// gérée par la base : elle n'est pas mappée ici.
@Entity('user_invitations')
export class UserInvitation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ length: 190 })
  email: string;

  @Column({ type: 'char', length: 64, select: false })
  token: string;

  @Column({ type: 'enum', enum: ['technician'], default: 'technician' })
  authority: 'technician';

  @Column({ name: 'team_id', type: 'bigint', unsigned: true })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team?: Team;

  @Column({ type: 'enum', enum: InvitationStatus, default: InvitationStatus.PENDING })
  status: InvitationStatus;

  @Column({ name: 'invited_by', type: 'bigint', unsigned: true, nullable: true })
  invitedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invited_by' })
  invitedBy?: User | null;

  @Column({ name: 'accepted_user_id', type: 'bigint', unsigned: true, nullable: true })
  acceptedUserId: number | null;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt: Date;

  @Column({ name: 'accepted_at', type: 'datetime', precision: 3, nullable: true })
  acceptedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
