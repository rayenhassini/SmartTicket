import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Equipment } from '../../equipment/entities/equipment.entity';
import { EquipmentSoft } from '../../equipment-softs/entities/equipment-soft.entity';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'nom_site', length: 150 })
  nomSite: string;

  @Column({ length: 50, nullable: true })
  longitude?: string;

  @Column({ length: 50, nullable: true })
  latitude?: string;

  @Column({ length: 255 })
  adresse: string;

  // Site <-> Equipment (Site.listEquipment[] en Mongo) — pure pivot,
  // aucune colonne propre -> @ManyToMany + @JoinTable, pas d'entity dédiée.
  @ManyToMany(() => Equipment)
  @JoinTable({
    name: 'site_equipment',
    joinColumn: { name: 'site_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'equipment_id', referencedColumnName: 'id' },
  })
  equipment: Equipment[];

  // Site <-> EquipmentSoft (Site.listEquipmentSoft[] en Mongo)
  @ManyToMany(() => EquipmentSoft)
  @JoinTable({
    name: 'site_equipmentsoft',
    joinColumn: { name: 'site_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'equipmentsoft_id', referencedColumnName: 'id' },
  })
  equipmentSofts: EquipmentSoft[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
