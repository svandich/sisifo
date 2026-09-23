import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryColumn()
  key: string; // see settings.service.ts for the known keys

  @Column()
  value: string;
}
