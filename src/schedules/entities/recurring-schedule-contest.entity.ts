import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('recurring_schedule_contests')
@Unique(['scheduleId', 'contestPlatform', 'contestExternalId'])
export class RecurringScheduleContest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scheduleId: number; // FK-by-convention to RecurringSchedule.id

  // Snapshot captured when added to the pool, same rationale as Announcement — dispatch never depends on external APIs
  @Column()
  contestPlatform: string;

  @Column()
  contestExternalId: string;

  @Column()
  contestName: string;

  @Column()
  contestUrl: string;

  @Column({ type: 'datetime' })
  contestStartTime: Date;

  @Column()
  contestDurationSeconds: number;

  @Column({ default: false })
  used: boolean;

  @Column({ nullable: true, type: 'datetime' })
  usedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
