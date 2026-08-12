import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  guildId: string; // Discord guild used to resolve a custom template, if any

  @Column()
  categoryId: number;

  @Column()
  contestPlatform: string; // 'codeforces' | 'atcoder'

  @Column()
  contestExternalId: string;

  @Column({ nullable: true })
  templateName: string;

  @Column({ type: 'datetime' })
  scheduledFor: Date;

  @Column({ nullable: true, type: 'datetime' })
  simulationStartTime: Date; // Simulaciones only: the actual start time of the sim (= scheduledFor + 5min)

  // Snapshot captured at schedule time so dispatch never depends on external APIs
  @Column({ nullable: true })
  contestName: string;

  @Column({ nullable: true })
  contestUrl: string;

  @Column({ nullable: true, type: 'datetime' })
  contestStartTime: Date;

  @Column({ nullable: true })
  contestDurationSeconds: number;

  @Column({ default: false })
  sent: boolean;

  @Column({ nullable: true, type: 'datetime' })
  sentAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
