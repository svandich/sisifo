import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('telegram_topics')
@Unique(['chatId', 'threadId'])
export class TelegramTopic {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chatId: string;

  @Column()
  threadId: string;

  @Column({ nullable: true })
  title: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
