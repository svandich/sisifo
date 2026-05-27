import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('category_tags')
@Unique(['categoryId', 'platform', 'type', 'targetId', 'scopeId'])
export class CategoryTag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  categoryId: number;

  @Column()
  platform: string; // 'discord' | 'telegram'

  @Column()
  type: string; // 'user' | 'role'

  @Column()
  targetId: string; // Discord userId/roleId, or Telegram userId as string

  @Column({ nullable: true })
  scopeId: string; // Discord guildId or Telegram chatId

  @Column({ nullable: true })
  displayName: string; // Telegram only — stored at subscribe time for mention HTML
}
