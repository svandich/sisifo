import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('recurring_polls')
export class RecurringPoll {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  categoryId: number; // FK-by-convention to Category.id — sent to that category's Telegram subscriptions (see polls.md)

  @Column()
  question: string;

  @Column({ type: 'simple-json' })
  options: string[];

  @Column({ type: 'simple-json' })
  weekdays: number[]; // 0 = domingo … 6 = sábado, as read in the configured time zone

  @Column()
  hour: number; // 0-23, wall clock in the configured time zone (see settings)

  @Column()
  minute: number; // 0-59, wall clock in the configured time zone (see settings)

  @Column({ default: false })
  isAnonymous: boolean; // off by default: the point is seeing *who* is coming

  @Column({ default: false })
  allowsMultipleAnswers: boolean;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'datetime' })
  nextRunAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
