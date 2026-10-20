import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Contract } from './contract.entity';
import { TypeSupport } from '../../type-supports/entities/type-support.entity';

// Table de jonction `contract_type_supports` — porte `support_id` -> entity dédiée.
@Entity('contract_type_supports')
export class ContractTypeSupport {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'support_id', length: 150 })
  supportId: string;

  @ManyToOne(() => Contract, (contract) => contract.typeSupportLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => TypeSupport, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'type_support_id' })
  typeSupport: TypeSupport;
}
