import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Client, TextChannel } from 'discord.js';
import { Announcement } from './entities/announcement.entity';
import { TemplatesService } from '../templates/templates.service';
import { CategoriesService } from '../categories/categories.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TelegramService } from '../telegram/telegram.service';
import { CategoryTagsService } from '../category-tags/category-tags.service';
import { formatDate, formatDatePlain, formatDuration, markdownToHtml } from '../common/format.util';
import { DEFAULT_SIMULACION_ADMIN_TEMPLATE, DEFAULT_SIMULACION_PUBLIC_TEMPLATE } from '../templates/templates.service';

export interface ScheduleAnnouncementDto {
  scheduledByGuildId: string;
  categorySlug: string;
  contestPlatform: string;
  contestExternalId: string;
  contestName: string;
  contestUrl: string;
  contestStartTime: Date;
  contestDurationSeconds: number;
  templateName?: string;
  scheduledFor: Date;
  simulationStartTime?: Date;
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);
  private discordClient: Client;

  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
    private readonly templates: TemplatesService,
    private readonly categories: CategoriesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly telegram: TelegramService,
    private readonly categoryTags: CategoryTagsService,
  ) {}

  setDiscordClient(client: Client) {
    this.discordClient = client;
  }

  async schedule(dto: ScheduleAnnouncementDto): Promise<Announcement> {
    const category = await this.categories.findBySlug(dto.categorySlug);
    if (!category) throw new Error(`Categoría "${dto.categorySlug}" no encontrada.`);

    return this.repo.save(
      this.repo.create({
        scheduledByGuildId: dto.scheduledByGuildId,
        categoryId: category.id,
        contestPlatform: dto.contestPlatform,
        contestExternalId: dto.contestExternalId,
        contestName: dto.contestName,
        contestUrl: dto.contestUrl,
        contestStartTime: dto.contestStartTime,
        contestDurationSeconds: dto.contestDurationSeconds,
        templateName: dto.templateName ?? null,
        scheduledFor: dto.scheduledFor,
        simulationStartTime: dto.simulationStartTime ?? null,
        sent: false,
      }),
    );
  }

  async listPending(guildId: string): Promise<Announcement[]> {
    return this.repo.find({
      where: { scheduledByGuildId: guildId, sent: false },
      order: { scheduledFor: 'ASC' },
    });
  }

  async cancel(guildId: string, id: number): Promise<void> {
    const announcement = await this.repo.findOneBy({ id, scheduledByGuildId: guildId });
    if (!announcement) throw new Error(`Anuncio #${id} no encontrado.`);
    if (announcement.sent) throw new Error(`El anuncio #${id} ya fue enviado.`);
    await this.repo.delete(id);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatch() {
    if (!this.discordClient?.isReady()) return;

    const due = await this.repo.find({
      where: { sent: false, scheduledFor: LessThanOrEqual(new Date()) },
    });

    for (const announcement of due) {
      await this.sendAnnouncement(announcement);
    }
  }

  private async sendAnnouncement(announcement: Announcement) {
    try {
      const category = await this.categories.findById(announcement.categoryId);
      const subs = await this.subscriptions.findByCategory(announcement.categoryId);
      const isSimulacion = category?.type === 'simulacion';

      // For simulaciones the displayed start time is the stored simulationStartTime, not the original contest start.
      const simStart = announcement.simulationStartTime ?? announcement.scheduledFor;

      // Use the snapshot captured at schedule time — dispatch never depends on external APIs.
      const contestName = announcement.contestName;
      const contestUrl = announcement.contestUrl;
      const contestStartTime = announcement.contestStartTime;
      const contestDurationSeconds = announcement.contestDurationSeconds;
      const platform = announcement.contestPlatform;

      const buildDiscordVars = (includeIdentity: boolean) => ({
        contest_name: includeIdentity ? contestName : '???',
        platform: includeIdentity ? platform : '???',
        start_time: formatDate(isSimulacion ? simStart : contestStartTime),
        duration: formatDuration(contestDurationSeconds),
        contest_url: includeIdentity ? contestUrl : '',
      });

      const buildTelegramVars = (includeIdentity: boolean) => ({
        contest_name: includeIdentity ? contestName : '???',
        platform: includeIdentity ? platform : '???',
        start_time: formatDatePlain(isSimulacion ? simStart : contestStartTime),
        duration: formatDuration(contestDurationSeconds),
        contest_url: includeIdentity ? contestUrl : '',
      });

      for (const sub of subs) {
        const includeIdentity = !isSimulacion || sub.adminOnly;

        if (sub.platform === 'discord') {
          const tags = await this.categoryTags.buildDiscordMentions(announcement.categoryId, sub.guildId);
          const discordVars = { ...buildDiscordVars(includeIdentity), tags };
          const template = isSimulacion
            ? (sub.adminOnly ? DEFAULT_SIMULACION_ADMIN_TEMPLATE : DEFAULT_SIMULACION_PUBLIC_TEMPLATE)
            : null;
          const discordMsg = isSimulacion
            ? this.templates.render(template!, discordVars)
            : await this.templates.renderTemplate(announcement.scheduledByGuildId, announcement.templateName, discordVars);

          const channel = await this.discordClient.channels.fetch(sub.chatId).catch(() => null);
          if (channel instanceof TextChannel) await channel.send(discordMsg);
        } else if (sub.platform === 'telegram') {
          const tags = await this.categoryTags.buildTelegramMentions(announcement.categoryId, sub.chatId);
          const telegramVars = { ...buildTelegramVars(includeIdentity), tags };
          const template = isSimulacion
            ? (sub.adminOnly ? DEFAULT_SIMULACION_ADMIN_TEMPLATE : DEFAULT_SIMULACION_PUBLIC_TEMPLATE)
            : null;
          const telegramMsg = markdownToHtml(
            isSimulacion
              ? this.templates.render(template!, telegramVars)
              : await this.templates.renderTemplate(announcement.scheduledByGuildId, announcement.templateName, telegramVars),
          );
          await this.telegram.send(sub.chatId, telegramMsg, sub.threadId ?? undefined);
        }
      }

      await this.markSent(announcement);
      this.logger.log(`Anuncio #${announcement.id} enviado a ${subs.length} suscriptores`);
    } catch (err) {
      this.logger.error(`Error enviando anuncio #${announcement.id}: ${err.message}`);
    }
  }

  private async markSent(announcement: Announcement) {
    announcement.sent = true;
    announcement.sentAt = new Date();
    await this.repo.save(announcement);
  }
}
