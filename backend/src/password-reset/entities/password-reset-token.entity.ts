import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Table `password_reset_tokens` (migration 004).
// `token` contient le HASH SHA-256 du jeton (le jeton en clair n'est que dans le lien du mail).
@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: number;

  @Column({ type: 'char', length: 64, select: false })
  token: string;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'datetime', precision: 3, nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
