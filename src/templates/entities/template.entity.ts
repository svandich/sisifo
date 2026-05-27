import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('templates')
@Unique(['guildId', 'name'])
export class Template {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column()
  name: string;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
