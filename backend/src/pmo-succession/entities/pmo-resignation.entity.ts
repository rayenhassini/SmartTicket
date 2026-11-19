import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ResignationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

// Table `pmo_resignations` (migration 008). `token` = HASH SHA-256 du jeton (le clair n'est que dans l'email).
// `pending_flag` (colonne générée, UNIQUE) garantit une seule démission « pending » ; gérée par la base, non mappée.
@Entity('pmo_resignations')
export class PmoResignation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'successor_email', length: 190 })
  successorEmail: string;

  @Column({ type: 'char', length: 64, select: false })
  token: string;

  @Column({ type: 'enum', enum: ResignationStatus, default: ResignationStatus.PENDING })
  status: ResignationStatus;

  @Column({ name: 'resigning_user_id', type: 'bigint', unsigned: true, nullable: true })
  resigningUserId: number | null;

  @Column({ name: 'successor_user_id', type: 'bigint', unsigned: true, nullable: true })
  successorUserId: number | null;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
