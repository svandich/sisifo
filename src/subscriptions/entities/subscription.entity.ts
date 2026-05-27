import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('subscriptions')
@Unique(['categoryId', 'platform', 'chatId', 'threadId', 'adminOnly'])
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  categoryId: number;

  @Column()
  platform: string; // 'discord' | 'telegram'

  @Column()
  chatId: string; // Discord channelId or Telegram chat_id (string)

  @Column({ nullable: true })
  guildId: string; // Discord only — for guild-scoped management

  @Column({ nullable: true })
  threadId: string; // Telegram message_thread_id for topics

  @Column({ default: false })
  adminOnly: boolean; // Receives full contest details for simulaciones; public subs get redacted message
}
