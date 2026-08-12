import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('telegram_chats')
export class TelegramChat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  chatId: string;

  @Column({ nullable: true })
  title: string;

  @Column()
  type: string; // 'group' | 'supergroup' | 'channel' | 'private'

  @UpdateDateColumn()
  updatedAt: Date;
}
