import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { InvitationStatus } from '../../invitations/entities/user-invitation.entity';

// Table `client_invitations` (migration 005) : invitation d'un CLIENT (aucune équipe).
// Schéma réel : id CHAR(36) (UUID généré par l'application), status VARCHAR(32), dates DATETIME(6),
// FK vers users(id) en BIGINT UNSIGNED. `tokenHash` = SHA-256 du jeton (le jeton en clair n'est que dans le lien du mail).
// La colonne `pending_email` (unicité d'une invitation en attente par email) est facultative (migration 007) :
// gérée par la base, non mappée ici.
@Entity('client_invitations')
export class ClientInvitation {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ length: 255 })
  email: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, select: false })
  tokenHash: string;

  @Column({ type: 'varchar', length: 32, default: InvitationStatus.PENDING })
  status: InvitationStatus;

  // users.id est un BIGINT UNSIGNED (mysql2 le renvoie en string : toujours comparer avec String()).
  @Column({ name: 'invited_by_user_id', type: 'bigint', unsigned: true })
  invitedById: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invited_by_user_id' })
  invitedBy?: User;

  @Column({ name: 'created_user_id', type: 'bigint', unsigned: true, nullable: true })
  acceptedUserId: number | null;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt: Date;

  @Column({ name: 'accepted_at', type: 'datetime', precision: 6, nullable: true })
  acceptedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
