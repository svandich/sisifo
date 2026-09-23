import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('recurring_schedules')
export class RecurringSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  categoryId: number; // FK-by-convention to Category.id — must be a 'normal' category

  @Column({ nullable: true })
  guildId: string; // Discord guild used to resolve a custom template, if any (see Announcement.guildId)

  @Column({ nullable: true })
  templateName: string;

  @Column()
  intervalDays: number;

  @Column()
  hour: number; // 0-23, wall clock in the configured time zone (see settings)

  @Column()
  minute: number; // 0-59, wall clock in the configured time zone (see settings)

  @Column({ default: true })
  active: boolean; // set to false automatically once the contest pool is exhausted

  @Column({ type: 'datetime' })
  nextRunAt: Date;

  @Column({ type: 'int', nullable: true })
  nextContestId: number | null; // pre-selected RecurringScheduleContest.id for the next run — see schedules.md

  @CreateDateColumn()
  createdAt: Date;
}
