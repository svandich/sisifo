import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryTag } from './entities/category-tag.entity';
import { CategoriesService } from '../categories/categories.service';
import { escapeHtml } from '../common/format.util';

@Injectable()
export class CategoryTagsService {
  constructor(
    @InjectRepository(CategoryTag)
    private readonly repo: Repository<CategoryTag>,
    private readonly categories: CategoriesService,
  ) {}

  async addUserDiscord(guildId: string, userId: string, categorySlug: string): Promise<void> {
    const category = await this.categories.findBySlug(categorySlug);
    if (!category) throw new Error(`Categoría "${categorySlug}" no encontrada.`);

    const existing = await this.repo.findOneBy({ categoryId: category.id, platform: 'discord', type: 'user', targetId: userId, scopeId: guildId });
    if (existing) throw new Error(`Ya estás suscrito a menciones de "${category.displayName}".`);

    await this.repo.save(this.repo.create({ categoryId: category.id, platform: 'discord', type: 'user', targetId: userId, scopeId: guildId }));
  }

  async removeUserDiscord(guildId: string, userId: string, categorySlug: string): Promise<void> {
    const category = await this.categories.findBySlug(categorySlug);
    if (!category) throw new Error(`Categoría "${categorySlug}" no encontrada.`);

    const tag = await this.repo.findOneBy({ categoryId: category.id, platform: 'discord', type: 'user', targetId: userId, scopeId: guildId });
    if (!tag) throw new Error(`No estás suscrito a menciones de "${category.displayName}".`);

    await this.repo.delete(tag.id);
  }

  async addRoleDiscord(guildId: string, roleId: string, categorySlug: string): Promise<void> {
    const category = await this.categories.findBySlug(categorySlug);
    if (!category) throw new Error(`Categoría "${categorySlug}" no encontrada.`);

    const existing = await this.repo.findOneBy({ categoryId: category.id, platform: 'discord', type: 'role', targetId: roleId, scopeId: guildId });
    if (existing) throw new Error(`El rol ya está en las menciones de "${category.displayName}".`);

    await this.repo.save(this.repo.create({ categoryId: category.id, platform: 'discord', type: 'role', targetId: roleId, scopeId: guildId }));
  }

  async removeRoleDiscord(guildId: string, roleId: string, categorySlug: string): Promise<void> {
    const category = await this.categories.findBySlug(categorySlug);
    if (!category) throw new Error(`Categoría "${categorySlug}" no encontrada.`);

    const tag = await this.repo.findOneBy({ categoryId: category.id, platform: 'discord', type: 'role', targetId: roleId, scopeId: guildId });
    if (!tag) throw new Error(`El rol no está en las menciones de "${category.displayName}".`);

    await this.repo.delete(tag.id);
  }

  async addUserTelegram(chatId: string, userId: string, displayName: string, categorySlug: string): Promise<void> {
    const category = await this.categories.findBySlug(categorySlug);
    if (!category) throw new Error(`Categoría "${categorySlug}" no encontrada.`);

    const existing = await this.repo.findOneBy({ categoryId: category.id, platform: 'telegram', type: 'user', targetId: userId, scopeId: chatId });
    if (existing) throw new Error(`Ya estás suscrito a menciones de "${category.displayName}".`);

    await this.repo.save(this.repo.create({ categoryId: category.id, platform: 'telegram', type: 'user', targetId: userId, scopeId: chatId, displayName }));
  }

  async removeUserTelegram(chatId: string, userId: string, categorySlug: string): Promise<void> {
    const category = await this.categories.findBySlug(categorySlug);
    if (!category) throw new Error(`Categoría "${categorySlug}" no encontrada.`);

    const tag = await this.repo.findOneBy({ categoryId: category.id, platform: 'telegram', type: 'user', targetId: userId, scopeId: chatId });
    if (!tag) throw new Error(`No estás suscrito a menciones de "${category.displayName}".`);

    await this.repo.delete(tag.id);
  }

  async buildDiscordMentions(categoryId: number, guildId: string): Promise<string> {
    const tags = await this.repo.findBy({ categoryId, platform: 'discord', scopeId: guildId });
    return tags.map((t) => (t.type === 'role' ? `<@&${t.targetId}>` : `<@${t.targetId}>`)).join(' ');
  }

  async buildTelegramMentions(categoryId: number, chatId: string): Promise<string> {
    const tags = await this.repo.findBy({ categoryId, platform: 'telegram', scopeId: chatId });
    return tags.map((t) => `<a href="tg://user?id=${t.targetId}">${escapeHtml(t.displayName ?? t.targetId)}</a>`).join(' ');
  }

  async findAll(): Promise<CategoryTag[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async removeById(id: number): Promise<void> {
    const tag = await this.repo.findOneBy({ id });
    if (!tag) throw new Error(`Mención #${id} no encontrada.`);
    await this.repo.delete(id);
  }
}
