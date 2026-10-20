import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserAuthority } from '../../common/enums/user-authority.enum';
import { ClientRole } from '../../common/enums/client-role.enum';

// Table `users` — STI (Single Table Inheritance) : une seule table porte
// les champs communs (User) + les champs spécifiques Client / Technicien.
// Les champs Commercial/HelpDesk ne sont volontairement pas repris ici
// (cf. décisions actées sur le schéma SQL P1).
@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ length: 190, unique: true })
  email: string;

  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  @Column({ name: 'phone_number', length: 30, nullable: true })
  phoneNumber?: string;

  @Column({ type: 'enum', enum: UserAuthority })
  authority: UserAuthority;

  @Column({ name: 'image_path', length: 500, nullable: true })
  imagePath?: string;

  @Column({ default: false })
  valid: boolean;

  @Column({ name: 'team_leader', default: false })
  teamLeader: boolean;

  // --- Champs spécifiques Client (authority = CLIENT) ---
  @Column({ length: 150, nullable: true })
  company?: string;

  @Column({ name: 'client_role', type: 'enum', enum: ClientRole, nullable: true })
  clientRole?: ClientRole;

  @Column({ type: 'text', nullable: true })
  about?: string;

  // --- Champs spécifiques Technicien (authority = TECHNICIAN) ---
  @Column({ name: 'permis_conduire', default: false, nullable: true })
  permisConduire?: boolean;

  @Column({ default: false, nullable: true })
  passeport?: boolean;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate?: string;

  @Column({ name: 'expired_at', type: 'date', nullable: true })
  expiredAt?: string;

  @Column({ name: 'signature_path', length: 500, nullable: true })
  signaturePath?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
