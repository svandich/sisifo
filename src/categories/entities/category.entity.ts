import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  slug: string;

  @Column()
  displayName: string;

  @Column({ default: 'simulacion' })
  type: string; // 'normal' | 'simulacion'
}
