import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TextChannel } from 'discord.js';
import { Announcement } from './entities/announcement.entity';
import { TemplatesService } from '../templates/templates.service';
import { CategoriesService } from '../categories/categories.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TelegramService } from '../telegram/telegram.service';
import { CategoryTagsService } from '../category-tags/category-tags.service';
import { ContestsService } from '../contests/contests.service';
import { DiscordClientService } from '../discord-client/discord-client.service';
import { formatDate, formatDatePlain, formatDuration, formatTime, formatTimePlain, markdownToHtml } from '../common/format.util';
import { parseWhen } from '../common/parse-when.util';
import { DEFAULT_SIMULACION_ADMIN_TEMPLATE, DEFAULT_SIMULACION_PUBLIC_TEMPLATE, DEFAULT_VIRTUAL_TEMPLATE } from '../templates/templates.service';

const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

export interface ScheduleAnnouncementDto {
  guildId?: string;
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

export interface ScheduleFromContestDto {
  platform: string;
  contestId: string;
  categorySlug: string;
  cuando?: string;
  templateName?: string;
  guildId?: string;
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
    private readonly templates: TemplatesService,
    private readonly categories: CategoriesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly telegram: TelegramService,
    private readonly categoryTags: CategoryTagsService,
    private readonly contests: ContestsService,
    private readonly discordClientService: DiscordClientService,
  ) {}

  async schedule(dto: ScheduleAnnouncementDto): Promise<Announcement> {
    const category = await this.categories.findBySlug(dto.categorySlug);
    if (!category) throw new Error(`Categoría "${dto.categorySlug}" no encontrada.`);

    return this.repo.save(
      this.repo.create({
        guildId: dto.guildId ?? null,
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

  /**
   * Looks up a contest and validates category/template/timing rules, mirroring the
   * behaviour the old `/anunciar programar` Discord command used to enforce.
   */
  async scheduleFromContest(dto: ScheduleFromContestDto): Promise<Announcement> {
    const contest = await this.contests.getContestById(dto.platform, dto.contestId);
    if (!contest) throw new Error(`No se encontró el concurso "${dto.contestId}" en ${dto.platform}.`);

    const category = await this.categories.findBySlug(dto.categorySlug);
    if (!category) throw new Error(`Categoría "${dto.categorySlug}" no encontrada.`);

    if (dto.templateName) {
      if (!dto.guildId) throw new Error('Debes seleccionar un servidor para usar una plantilla personalizada.');
      await this.templates.findOne(dto.guildId, dto.templateName);
    }

    let scheduledFor: Date;
    let simulationStartTime: Date | undefined;

    if (category.type === 'simulacion') {
      if (!dto.cuando) throw new Error('Las simulaciones requieren la hora de inicio de la simulación.');
      const simStart = parseWhen(dto.cuando);
      if (!simStart) throw new Error('Formato de tiempo inválido.');
      simulationStartTime = simStart;
      scheduledFor = new Date(simStart.getTime() - FIVE_MINUTES);
    } else if (dto.cuando) {
      const parsed = parseWhen(dto.cuando);
      if (!parsed) throw new Error('Formato de tiempo inválido.');
      if (contest.phase !== 'UPCOMING') {
        simulationStartTime = parsed;
        scheduledFor = new Date(parsed.getTime() - FIVE_MINUTES);
      } else {
        scheduledFor = parsed;
      }
    } else if (contest.phase === 'UPCOMING') {
      scheduledFor = new Date(contest.startTime.getTime() - THIRTY_MINUTES);
    } else {
      throw new Error(`El concurso "${contest.name}" ya comenzó. Debes indicar cuándo enviar el anuncio.`);
    }

    if (scheduledFor <= new Date()) throw new Error('La hora programada ya pasó. Especifica un tiempo en el futuro.');

    return this.schedule({
      guildId: dto.guildId,
      categorySlug: dto.categorySlug,
      contestPlatform: dto.platform,
      contestExternalId: dto.contestId,
      contestName: contest.name,
      contestUrl: contest.url,
      contestStartTime: contest.startTime,
      contestDurationSeconds: contest.durationSeconds,
      templateName: dto.templateName,
      scheduledFor,
      simulationStartTime,
    });
  }

  async listPending(): Promise<Announcement[]> {
    return this.repo.find({
      where: { sent: false },
      order: { scheduledFor: 'ASC' },
    });
  }

  async cancel(id: number): Promise<void> {
    const announcement = await this.repo.findOneBy({ id });
    if (!announcement) throw new Error(`Anuncio #${id} no encontrado.`);
    if (announcement.sent) throw new Error(`El anuncio #${id} ya fue enviado.`);
    await this.repo.delete(id);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatch() {
    const client = this.discordClientService.get();
    if (!client?.isReady()) return;

    const due = await this.repo.find({
      where: { sent: false, scheduledFor: LessThanOrEqual(new Date()) },
    });

    for (const announcement of due) {
      await this.sendAnnouncement(announcement);
    }
  }

  private async sendAnnouncement(announcement: Announcement) {
    try {
      const client = this.discordClientService.get();
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

      // VP = past contest where the announcement fires at or after the original contest start
      const isVirtual = !isSimulacion && !!announcement.contestStartTime && announcement.contestStartTime <= announcement.scheduledFor;
      const normalFallback = isVirtual ? DEFAULT_VIRTUAL_TEMPLATE : undefined;

      const buildDiscordVars = (includeIdentity: boolean) => ({
        contest_name: includeIdentity ? contestName : '???',
        platform: includeIdentity ? platform : '???',
        start_time: formatDate(isSimulacion ? simStart : contestStartTime),
        duration: formatDuration(contestDurationSeconds),
        contest_url: includeIdentity ? contestUrl : '',
        vp_time: formatTime(simStart),
      });

      const buildTelegramVars = (includeIdentity: boolean) => ({
        contest_name: includeIdentity ? contestName : '???',
        platform: includeIdentity ? platform : '???',
        start_time: formatDatePlain(isSimulacion ? simStart : contestStartTime),
        duration: formatDuration(contestDurationSeconds),
        contest_url: includeIdentity ? contestUrl : '',
        vp_time: formatTimePlain(simStart),
      });

      for (const sub of subs) {
        const includeIdentity = !isSimulacion || sub.adminOnly;

        if (sub.platform === 'discord') {
          if (!client) continue;
          const tags = sub.guildId ? await this.categoryTags.buildDiscordMentions(announcement.categoryId, sub.guildId) : '';
          const discordVars = { ...buildDiscordVars(includeIdentity), tags };
          const template = isSimulacion
            ? (sub.adminOnly ? DEFAULT_SIMULACION_ADMIN_TEMPLATE : DEFAULT_SIMULACION_PUBLIC_TEMPLATE)
            : null;
          const discordMsg = isSimulacion
            ? this.templates.render(template!, discordVars)
            : await this.templates.renderTemplate(announcement.guildId ?? '', announcement.templateName, discordVars, normalFallback);

          const channel = await client.channels.fetch(sub.chatId).catch(() => null);
          if (channel instanceof TextChannel) await channel.send(tags ? `${tags}\n${discordMsg}` : discordMsg);
        } else if (sub.platform === 'telegram') {
          const tags = await this.categoryTags.buildTelegramMentions(announcement.categoryId, sub.chatId);
          const telegramVars = { ...buildTelegramVars(includeIdentity), tags };
          const template = isSimulacion
            ? (sub.adminOnly ? DEFAULT_SIMULACION_ADMIN_TEMPLATE : DEFAULT_SIMULACION_PUBLIC_TEMPLATE)
            : null;
          const telegramMsg = markdownToHtml(
            isSimulacion
              ? this.templates.render(template!, telegramVars)
              : await this.templates.renderTemplate(announcement.guildId ?? '', announcement.templateName, telegramVars, normalFallback),
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
