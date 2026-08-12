import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as TelegramBot from 'node-telegram-bot-api';
import { CategoriesService } from '../categories/categories.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CategoryTagsService } from '../category-tags/category-tags.service';
import { TelegramRegistryService } from './telegram-registry.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly categories: CategoriesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly categoryTags: CategoryTagsService,
    private readonly registry: TelegramRegistryService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_TOKEN no configurado — bot de Telegram desactivado');
      return;
    }
    this.bot = new TelegramBot(token, { polling: true });
    this.bot.on('message', (msg) => this.handleMessage(msg).catch((e) => this.logger.error(e.message)));
    this.logger.log('Bot de Telegram iniciado');
  }

  async onModuleDestroy() {
    if (this.bot) await this.bot.stopPolling();
  }

  async send(chatId: string, text: string, threadId?: string): Promise<void> {
    if (!this.bot) return;
    try {
      const opts: Record<string, unknown> = { parse_mode: 'HTML' };
      if (threadId) opts.message_thread_id = parseInt(threadId, 10);
      await this.bot.sendMessage(chatId, text, opts as TelegramBot.SendMessageOptions);
    } catch (err) {
      this.logger.error(`Error enviando mensaje de Telegram a ${chatId}: ${err.message}`);
    }
  }

  private async handleMessage(msg: TelegramBot.Message) {
    await this.trackChat(msg);

    const text = msg.text ?? '';
    if (!text.startsWith('/')) return;

    const parts = text.trim().split(/\s+/);
    const command = parts[0].split('@')[0].toLowerCase();
    const args = parts.slice(1);

    if (command === '/suscribir') await this.handleSuscribir(msg, args);
    else if (command === '/desuscribir') await this.handleDesuscribir(msg, args);
    else if (command === '/suscribirme') await this.handleSuscribirme(msg, args);
    else if (command === '/desuscribirme') await this.handleDesuscribirme(msg, args);
    else if (command === '/categorias') await this.handleCategorias(msg);
  }

  private async isAdmin(chatId: number, userId: number): Promise<boolean> {
    if (!this.bot) return false;
    try {
      const member = await this.bot.getChatMember(chatId, userId);
      return member.status === 'creator' || member.status === 'administrator';
    } catch {
      return false;
    }
  }

  /** Records chats/topics the bot sees so the admin panel can offer them as subscription targets. */
  private async trackChat(msg: TelegramBot.Message) {
    const chat = msg.chat;
    const title =
      chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id);
    await this.registry.trackChat(String(chat.id), title, chat.type);

    if (msg.message_thread_id) {
      const topicName = (msg as unknown as { forum_topic_created?: { name?: string } }).forum_topic_created?.name;
      await this.registry.trackTopic(String(chat.id), String(msg.message_thread_id), topicName);
    }
  }

  private reply(msg: TelegramBot.Message, text: string) {
    if (!this.bot) return Promise.resolve();
    const opts: Record<string, unknown> = { parse_mode: 'HTML' };
    if (msg.message_thread_id) opts.message_thread_id = msg.message_thread_id;
    return this.bot.sendMessage(msg.chat.id, text, opts as TelegramBot.SendMessageOptions);
  }

  private async handleSuscribir(msg: TelegramBot.Message, args: string[]) {
    const userId = msg.from?.id;
    if (!userId) return;

    if (!(await this.isAdmin(msg.chat.id, userId))) {
      await this.reply(msg, 'Solo los administradores del grupo pueden suscribirse a categorías.');
      return;
    }

    const slug = args[0];
    if (!slug) {
      await this.reply(msg, 'Uso: /suscribir &lt;categoría&gt; [admin]\n\nEjemplo: <code>/suscribir entrenamiento_semanal</code>\nUsa <code>admin</code> para recibir detalles completos de simulaciones.');
      return;
    }

    const adminOnly = args[1]?.toLowerCase() === 'admin';

    try {
      const threadId = msg.message_thread_id ? String(msg.message_thread_id) : undefined;
      await this.subscriptions.subscribeTelegram(String(msg.chat.id), slug, threadId, adminOnly);
      const category = await this.categories.findBySlug(slug);
      const adminLabel = adminOnly ? ' <b>(admin — verá detalles completos de simulaciones)</b>' : '';
      await this.reply(msg, `✅ Suscrito a <b>${category!.displayName}</b>.${adminLabel} Los anuncios de esta categoría llegarán aquí.`);
    } catch (err) {
      await this.reply(msg, `❌ Error: ${err.message}`);
    }
  }

  private async handleDesuscribir(msg: TelegramBot.Message, args: string[]) {
    const userId = msg.from?.id;
    if (!userId) return;

    if (!(await this.isAdmin(msg.chat.id, userId))) {
      await this.reply(msg, 'Solo los administradores del grupo pueden cancelar suscripciones.');
      return;
    }

    const slug = args[0];
    if (!slug) {
      await this.reply(msg, 'Uso: /desuscribir &lt;categoría&gt; [admin]');
      return;
    }

    const adminOnly = args[1]?.toLowerCase() === 'admin';

    try {
      const threadId = msg.message_thread_id ? String(msg.message_thread_id) : undefined;
      await this.subscriptions.unsubscribeTelegram(String(msg.chat.id), slug, threadId, adminOnly);
      await this.reply(msg, `✅ Suscripción${adminOnly ? ' (admin)' : ''} a <b>${slug}</b> cancelada.`);
    } catch (err) {
      await this.reply(msg, `❌ Error: ${err.message}`);
    }
  }

  private async handleSuscribirme(msg: TelegramBot.Message, args: string[]) {
    const userId = msg.from?.id;
    if (!userId) return;

    const slug = args[0];
    if (!slug) {
      await this.reply(msg, 'Uso: /suscribirme &lt;categoría&gt;\n\nEjemplo: <code>/suscribirme entrenamiento_semanal</code>\nSerás mencionado cuando se anuncie esa categoría en este chat (requiere <code>{{tags}}</code> en el template).');
      return;
    }

    const displayName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || String(userId);

    try {
      await this.categoryTags.addUserTelegram(String(msg.chat.id), String(userId), displayName, slug);
      const category = await this.categories.findBySlug(slug);
      await this.reply(msg, `✅ <b>${displayName}</b> será mencionado en los anuncios de <b>${category!.displayName}</b>.`);
    } catch (err) {
      await this.reply(msg, `❌ Error: ${err.message}`);
    }
  }

  private async handleDesuscribirme(msg: TelegramBot.Message, args: string[]) {
    const userId = msg.from?.id;
    if (!userId) return;

    const slug = args[0];
    if (!slug) {
      await this.reply(msg, 'Uso: /desuscribirme &lt;categoría&gt;');
      return;
    }

    try {
      await this.categoryTags.removeUserTelegram(String(msg.chat.id), String(userId), slug);
      await this.reply(msg, `✅ Ya no serás mencionado en anuncios de <b>${slug}</b>.`);
    } catch (err) {
      await this.reply(msg, `❌ Error: ${err.message}`);
    }
  }

  private async handleCategorias(msg: TelegramBot.Message) {
    const cats = await this.categories.findAll();
    if (!cats.length) {
      await this.reply(msg, 'No hay categorías disponibles aún.');
      return;
    }
    const list = cats.map((c) => `• <b>${c.displayName}</b> — <code>${c.slug}</code>`).join('\n');
    await this.reply(msg, `<b>Categorías disponibles:</b>\n${list}\n\nUsa <code>/suscribir &lt;slug&gt;</code> para suscribirte.`);
  }
}
