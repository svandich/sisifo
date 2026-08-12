import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramChat } from './entities/telegram-chat.entity';
import { TelegramTopic } from './entities/telegram-topic.entity';

@Injectable()
export class TelegramRegistryService {
  constructor(
    @InjectRepository(TelegramChat)
    private readonly chats: Repository<TelegramChat>,
    @InjectRepository(TelegramTopic)
    private readonly topics: Repository<TelegramTopic>,
  ) {}

  async trackChat(chatId: string, title: string, type: string): Promise<void> {
    const existing = await this.chats.findOneBy({ chatId });
    if (existing) {
      existing.title = title;
      existing.type = type;
      await this.chats.save(existing);
    } else {
      await this.chats.save(this.chats.create({ chatId, title, type }));
    }
  }

  async trackTopic(chatId: string, threadId: string, title?: string): Promise<void> {
    const existing = await this.topics.findOneBy({ chatId, threadId });
    if (existing) {
      if (title && title !== existing.title) await this.topics.save({ ...existing, title });
      return;
    }
    await this.topics.save(this.topics.create({ chatId, threadId, title }));
  }

  async findAllChats(): Promise<TelegramChat[]> {
    return this.chats.find({ order: { title: 'ASC' } });
  }

  async findTopicsForChat(chatId: string): Promise<TelegramTopic[]> {
    return this.topics.findBy({ chatId });
  }
}
