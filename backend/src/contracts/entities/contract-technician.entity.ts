import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { User } from '../../users/entities/user.entity';

// Table de jonction `contract_technicians` — PK composite (contract_id,
// technician_id) + colonne propre `team_leader` -> entity dédiée.
@Entity('contract_technicians')
export class ContractTechnician {
  @PrimaryColumn({ name: 'contract_id', type: 'bigint', unsigned: true })
  contractId: number;

  @PrimaryColumn({ name: 'technician_id', type: 'bigint', unsigned: true })
  technicianId: number;

  @Column({ name: 'team_leader', default: false })
  teamLeader: boolean;

  @ManyToOne(() => Contract, (contract) => contract.technicianLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'technician_id' })
  technician: User;
}
