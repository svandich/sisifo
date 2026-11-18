import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringPoll } from './entities/recurring-poll.entity';
import { CategoriesService } from '../categories/categories.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TelegramService } from '../telegram/telegram.service';
import { SettingsService } from '../settings/settings.service';
import { formatDateInZone, getZonedParts, timeZoneLabel, zonedTimeToUtc } from '../common/timezone.util';

export interface PollDto {
  categorySlug: string;
  question: string;
  options: string[];
  weekdays: number[];
  hour: number;
  minute: number;
  isAnonymous?: boolean;
  allowsMultipleAnswers?: boolean;
}

export type UpdatePollDto = Partial<PollDto> & { active?: boolean };

// Telegram Bot API limits for sendPoll.
const MAX_QUESTION_LENGTH = 300;
const MAX_OPTION_LENGTH = 100;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

/**
 * A run this far behind schedule (bot was down) is skipped instead of sent: a "¿participas mañana?"
 * arriving the morning of the contest — or a day later — is worse than no poll at all.
 */
const MAX_LATENESS_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  constructor(
    @InjectRepository(RecurringPoll)
    private readonly repo: Repository<RecurringPoll>,
    private readonly categories: CategoriesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly telegram: TelegramService,
    private readonly settings: SettingsService,
  ) {}

  async create(dto: PollDto): Promise<RecurringPoll> {
    const category = await this.categories.findBySlug(dto.categorySlug);
    if (!category) throw new Error(`Categoría "${dto.categorySlug}" no encontrada.`);
    const question = PollsService.validateQuestion(dto.question);
    const options = PollsService.validateOptions(dto.options);
    const weekdays = PollsService.validateWeekdays(dto.weekdays);
    PollsService.validateTime(dto.hour, dto.minute);

    return this.repo.save(
      this.repo.create({
        categoryId: category.id,
        question,
        options,
        weekdays,
        hour: dto.hour,
        minute: dto.minute,
        isAnonymous: dto.isAnonymous ?? false,
        allowsMultipleAnswers: dto.allowsMultipleAnswers ?? false,
        active: true,
        nextRunAt: PollsService.nextOccurrence(weekdays, dto.hour, dto.minute, new Date(), this.settings.getTimezone()),
        lastSentAt: null,
      }),
    );
  }

  findAll(): Promise<RecurringPoll[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async update(id: number, dto: UpdatePollDto): Promise<RecurringPoll> {
    const poll = await this.repo.findOneBy({ id });
    if (!poll) throw new Error(`Encuesta #${id} no encontrada.`);

    if (dto.categorySlug !== undefined) {
      const category = await this.categories.findBySlug(dto.categorySlug);
      if (!category) throw new Error(`Categoría "${dto.categorySlug}" no encontrada.`);
      poll.categoryId = category.id;
    }
    if (dto.question !== undefined) poll.question = PollsService.validateQuestion(dto.question);
    if (dto.options !== undefined) poll.options = PollsService.validateOptions(dto.options);
    if (dto.isAnonymous !== undefined) poll.isAnonymous = dto.isAnonymous;
    if (dto.allowsMultipleAnswers !== undefined) poll.allowsMultipleAnswers = dto.allowsMultipleAnswers;

    let retime = false;
    if (dto.weekdays !== undefined) {
      poll.weekdays = PollsService.validateWeekdays(dto.weekdays);
      retime = true;
    }
    if (dto.hour !== undefined || dto.minute !== undefined) {
      const hour = dto.hour ?? poll.hour;
      const minute = dto.minute ?? poll.minute;
      PollsService.validateTime(hour, minute);
      poll.hour = hour;
      poll.minute = minute;
      retime = true;
    }
    if (dto.active !== undefined) {
      // Resuming must not fire a burst for the runs missed while paused.
      if (dto.active && !poll.active && poll.nextRunAt <= new Date()) retime = true;
      poll.active = dto.active;
    }

    // The weekday set fully defines the cadence (no "place in the cycle" to preserve, unlike
    // recurring schedules), so retiming is just "next matching slot from now".
    if (retime) poll.nextRunAt = PollsService.nextOccurrence(poll.weekdays, poll.hour, poll.minute, new Date(), this.settings.getTimezone());

    return this.repo.save(poll);
  }

  async delete(id: number): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new Error(`Encuesta #${id} no encontrada.`);
  }

  /**
   * Re-anchors every poll after the app time zone changed: `hour`/`minute`/`weekdays` are wall-clock
   * in the configured zone, so the stored `nextRunAt` instant no longer means the same local time.
   * Called by the admin settings controller right after `SettingsService.setTimezone`.
   */
  async retimeAllForTimezone(): Promise<number> {
    const timeZone = this.settings.getTimezone();
    const polls = await this.repo.find();
    const now = new Date();
    for (const poll of polls) poll.nextRunAt = PollsService.nextOccurrence(poll.weekdays, poll.hour, poll.minute, now, timeZone);
    await this.repo.save(polls);
    return polls.length;
  }

  /** Sends the poll right away (for testing from the panel) without touching its schedule. */
  async sendNow(id: number): Promise<{ sent: number; targets: number }> {
    const poll = await this.repo.findOneBy({ id });
    if (!poll) throw new Error(`Encuesta #${id} no encontrada.`);
    const category = await this.categories.findById(poll.categoryId);
    if (!category) throw new Error(`La categoría #${poll.categoryId} ya no existe.`);
    const result = await this.send(poll);
    if (result.targets === 0) throw new Error(`La categoría "${category.displayName}" no tiene chats de Telegram suscritos (no admin).`);
    if (result.sent === 0) throw new Error('No se pudo enviar la encuesta a ningún chat. Revisa que el bot de Telegram esté configurado y siga en el chat.');
    return result;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatch() {
    const now = new Date();
    const due = await this.repo.find({ where: { active: true, nextRunAt: LessThanOrEqual(now) } });
    for (const poll of due) await this.firePoll(poll, now);
  }

  private async firePoll(poll: RecurringPoll, now: Date) {
    const timeZone = this.settings.getTimezone();
    try {
      const category = await this.categories.findById(poll.categoryId);
      if (!category) {
        poll.active = false;
        await this.repo.save(poll);
        this.logger.error(`Encuesta #${poll.id} detenida: la categoría #${poll.categoryId} ya no existe.`);
        return;
      }

      const scheduledFor = poll.nextRunAt;
      // Advance first: a send failure must not leave the poll due, or it would re-send every minute
      // to the chats where it did go through.
      poll.nextRunAt = PollsService.nextOccurrence(poll.weekdays, poll.hour, poll.minute, now, timeZone);

      if (now.getTime() - scheduledFor.getTime() > MAX_LATENESS_MS) {
        await this.repo.save(poll);
        this.logger.warn(
          `Encuesta #${poll.id} omitida: debía enviarse ${formatDateInZone(scheduledFor, timeZone)} ${timeZoneLabel(scheduledFor, timeZone)} ` +
            `y ya es demasiado tarde.`,
        );
        return;
      }

      const { sent, targets } = await this.send(poll);
      poll.lastSentAt = now;
      await this.repo.save(poll);

      if (targets === 0) this.logger.warn(`Encuesta #${poll.id}: "${category.displayName}" no tiene chats de Telegram suscritos.`);
      this.logger.log(
        `Encuesta #${poll.id}: enviada a ${sent}/${targets} chats, próximo envío ${formatDateInZone(poll.nextRunAt, timeZone)} ` +
          `${timeZoneLabel(poll.nextRunAt, timeZone)}.`,
      );
    } catch (err) {
      this.logger.error(`Error procesando encuesta #${poll.id}: ${err.message}`);
    }
  }

  /**
   * Fans the poll out to the category's public Telegram subscriptions. Admin-only subscriptions are
   * skipped: those chats exist so organizers can see hidden simulación details, not to be asked
   * whether they're attending. A chat subscribed twice (e.g. two rows differing only by `adminOnly`)
   * gets the poll once.
   */
  private async send(poll: RecurringPoll): Promise<{ sent: number; targets: number }> {
    const subs = await this.subscriptions.findByCategory(poll.categoryId);
    const targets = new Map<string, { chatId: string; threadId?: string }>();
    for (const sub of subs) {
      if (sub.platform !== 'telegram' || sub.adminOnly) continue;
      targets.set(`${sub.chatId}:${sub.threadId ?? ''}`, { chatId: sub.chatId, threadId: sub.threadId ?? undefined });
    }

    let sent = 0;
    for (const target of targets.values()) {
      const ok = await this.telegram.sendPoll(target.chatId, poll.question, poll.options, {
        threadId: target.threadId,
        isAnonymous: poll.isAnonymous,
        allowsMultipleAnswers: poll.allowsMultipleAnswers,
      });
      if (ok) sent++;
    }
    return { sent, targets: targets.size };
  }

  /**
   * The first slot strictly after `from` whose *local* weekday (in `timeZone`) is in `weekdays`, at
   * `hour:minute` local time. Eight candidates cover "today, later" through "same weekday next week".
   */
  static nextOccurrence(weekdays: number[], hour: number, minute: number, from: Date, timeZone: string): Date {
    const today = getZonedParts(from, timeZone);
    for (let i = 0; i <= 7; i++) {
      // Date.UTC rolls the day over months/years; its weekday is the local calendar day's weekday.
      const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day + i)).getUTCDay();
      if (!weekdays.includes(weekday)) continue;
      const candidate = zonedTimeToUtc({ year: today.year, month: today.month, day: today.day + i, hour, minute, second: 0 }, timeZone);
      if (candidate > from) return candidate;
    }
    throw new Error('La encuesta no tiene días de envío válidos.');
  }

  private static validateQuestion(question: unknown): string {
    const q = typeof question === 'string' ? question.trim() : '';
    if (!q) throw new Error('La pregunta no puede estar vacía.');
    if (q.length > MAX_QUESTION_LENGTH) throw new Error(`La pregunta no puede superar ${MAX_QUESTION_LENGTH} caracteres.`);
    return q;
  }

  private static validateOptions(options: unknown): string[] {
    if (!Array.isArray(options)) throw new Error('Las opciones deben ser una lista.');
    const clean = options.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean);
    if (clean.length < MIN_OPTIONS || clean.length > MAX_OPTIONS) {
      throw new Error(`La encuesta debe tener entre ${MIN_OPTIONS} y ${MAX_OPTIONS} opciones.`);
    }
    const tooLong = clean.find((o) => o.length > MAX_OPTION_LENGTH);
    if (tooLong) throw new Error(`La opción "${tooLong.slice(0, 20)}…" supera ${MAX_OPTION_LENGTH} caracteres.`);
    return clean;
  }

  private static validateWeekdays(weekdays: unknown): number[] {
    if (!Array.isArray(weekdays)) throw new Error('Los días deben ser una lista.');
    const days = [...new Set(weekdays.map(Number))].sort((a, b) => a - b);
    if (days.length === 0) throw new Error('Elige al menos un día de la semana.');
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Día de la semana inválido.');
    return days;
  }

  private static validateTime(hour: number, minute: number) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error('La hora debe tener el formato HH:MM.');
    }
  }
}
