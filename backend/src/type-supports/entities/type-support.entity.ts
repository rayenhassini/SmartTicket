import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('type_supports')
export class TypeSupport {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'support_name', length: 150 })
  supportName: string;

  @Column({ name: 'support_email', length: 190 })
  supportEmail: string;

  @Column({ name: 'creation_date', type: 'datetime' })
  creationDate: Date;

  @Column({ name: 'logo_path', length: 500, nullable: true })
  logoPath?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
