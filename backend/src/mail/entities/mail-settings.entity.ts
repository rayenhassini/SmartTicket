import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Table `mail_settings` (migration 008) : une seule ligne (id = 1). `passwordEnc` est chiffré et jamais exposé.
@Entity('mail_settings')
export class MailSettings {
  @PrimaryColumn({ type: 'tinyint', unsigned: true })
  id: number;

  @Column({ length: 190 })
  gmail: string;

  @Column({ name: 'app_name', length: 100 })
  appName: string;

  @Column({ name: 'password_enc', type: 'text', select: false })
  passwordEnc: string;

  @Column({ name: 'updated_by', type: 'bigint', unsigned: true, nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
