import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly repo: Repository<Subscription>,
    private readonly categories: CategoriesService,
  ) {}

  async subscribeDiscord(guildId: string, channelId: string, categorySlug: string, adminOnly = false): Promise<Subscription> {
    const category = await this.categories.findBySlug(categorySlug);
    if (!category) throw new Error(`Categoría "${categorySlug}" no encontrada.`);

    const existing = await this.repo.findOneBy({ categoryId: category.id, platform: 'discord', chatId: channelId, adminOnly });
    if (existing) throw new Error(`Este canal ya está suscrito a "${category.displayName}"${adminOnly ? ' (admin)' : ''}.`);

    return this.repo.save(
      this.repo.create({ categoryId: category.id, platform: 'discord', chatId: channelId, guildId, adminOnly }),
    );
  }

  async unsubscribeDiscord(channelId: string, categorySlug: string, adminOnly = false): Promise<void> {
    const category = await this.categories.findBySlug(categorySlug);
    if (!category) throw new Error(`Categoría "${categorySlug}" no encontrada.`);

    const sub = await this.repo.findOneBy({ categoryId: category.id, platform: 'discord', chatId: channelId, adminOnly });
    if (!sub) throw new Error(`Este canal no está suscrito a "${category.displayName}"${adminOnly ? ' (admin)' : ''}.`);

    await this.repo.delete(sub.id);
  }

  async subscribeTelegram(chatId: string, categorySlug: string, threadId?: string, adminOnly = false): Promise<Subscription> {
    const category = await this.categories.findBySlug(categorySlug);
    if (!category) throw new Error(`Categoría "${categorySlug}" no encontrada.`);

    const existing = await this.repo.findOneBy({
      categoryId: category.id,
      platform: 'telegram',
      chatId,
      threadId: threadId ?? null,
      adminOnly,
    });
    if (existing) throw new Error(`Este chat ya está suscrito a "${category.displayName}"${adminOnly ? ' (admin)' : ''}.`);

    return this.repo.save(
      this.repo.create({ categoryId: category.id, platform: 'telegram', chatId, threadId: threadId ?? null, adminOnly }),
    );
  }

  async unsubscribeTelegram(chatId: string, categorySlug: string, threadId?: string, adminOnly = false): Promise<void> {
    const category = await this.categories.findBySlug(categorySlug);
    if (!category) throw new Error(`Categoría "${categorySlug}" no encontrada.`);

    const sub = await this.repo.findOneBy({
      categoryId: category.id,
      platform: 'telegram',
      chatId,
      threadId: threadId ?? null,
      adminOnly,
    });
    if (!sub) throw new Error(`Este chat no está suscrito a "${category.displayName}"${adminOnly ? ' (admin)' : ''}.`);

    await this.repo.delete(sub.id);
  }

  async findByCategory(categoryId: number): Promise<Subscription[]> {
    return this.repo.findBy({ categoryId });
  }

  async findByGuild(guildId: string): Promise<Subscription[]> {
    return this.repo.findBy({ guildId, platform: 'discord' });
  }

  async findAll(): Promise<Subscription[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async deleteById(id: number): Promise<void> {
    const sub = await this.repo.findOneBy({ id });
    if (!sub) throw new Error(`Suscripción #${id} no encontrada.`);
    await this.repo.delete(id);
  }
}
