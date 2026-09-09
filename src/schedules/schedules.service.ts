import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringSchedule } from './entities/recurring-schedule.entity';
import { RecurringScheduleContest } from './entities/recurring-schedule-contest.entity';
import { CategoriesService } from '../categories/categories.service';
import { ContestsService } from '../contests/contests.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { TemplatesService } from '../templates/templates.service';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreateScheduleDto {
  categorySlug: string;
  intervalDays: number;
  hour: number;
  minute: number;
  guildId?: string;
  templateName?: string;
}

export interface ScheduleWithContests extends RecurringSchedule {
  contests: RecurringScheduleContest[];
}

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    @InjectRepository(RecurringSchedule)
    private readonly repo: Repository<RecurringSchedule>,
    @InjectRepository(RecurringScheduleContest)
    private readonly contestRepo: Repository<RecurringScheduleContest>,
    private readonly categories: CategoriesService,
    private readonly contests: ContestsService,
    private readonly announcements: AnnouncementsService,
    private readonly templates: TemplatesService,
  ) {}

  async create(dto: CreateScheduleDto): Promise<RecurringSchedule> {
    if (!Number.isInteger(dto.intervalDays) || dto.intervalDays < 1) {
      throw new Error('El intervalo debe ser un número entero de días mayor a 0.');
    }
    if (!Number.isInteger(dto.hour) || dto.hour < 0 || dto.hour > 23 || !Number.isInteger(dto.minute) || dto.minute < 0 || dto.minute > 59) {
      throw new Error('La hora debe tener el formato HH:MM.');
    }

    const category = await this.categories.findBySlug(dto.categorySlug);
    if (!category) throw new Error(`Categoría "${dto.categorySlug}" no encontrada.`);
    if (category.type !== 'normal') {
      throw new Error('La programación recurrente solo está disponible para categorías de tipo "concurso próximo", no simulaciones.');
    }

    if (dto.templateName) {
      if (!dto.guildId) throw new Error('Debes seleccionar un servidor para usar una plantilla personalizada.');
      await this.templates.findOne(dto.guildId, dto.templateName);
    }

    return this.repo.save(
      this.repo.create({
        categoryId: category.id,
        guildId: dto.guildId ?? null,
        templateName: dto.templateName ?? null,
        intervalDays: dto.intervalDays,
        hour: dto.hour,
        minute: dto.minute,
        active: true,
        nextRunAt: SchedulesService.nextOccurrence(dto.hour, dto.minute, new Date()),
      }),
    );
  }

  async findAll(): Promise<ScheduleWithContests[]> {
    const schedules = await this.repo.find({ order: { id: 'ASC' } });
    if (schedules.length === 0) return [];
    // Self-healing: fills in a pick for schedules that don't have a valid one yet (rows created
    // before this column existed, or whose pick was removed from the pool).
    for (const schedule of schedules) await this.ensureNextPick(schedule);
    const scheduleIds = schedules.map((s) => s.id);
    const contests = await this.contestRepo.find({ where: { scheduleId: In(scheduleIds) } });
    return schedules.map((s) => ({ ...s, contests: contests.filter((c) => c.scheduleId === s.id) }));
  }

  async setActive(id: number, active: boolean): Promise<RecurringSchedule> {
    const schedule = await this.repo.findOneBy({ id });
    if (!schedule) throw new Error(`Programación #${id} no encontrada.`);
    schedule.active = active;
    if (active && schedule.nextRunAt <= new Date()) {
      schedule.nextRunAt = SchedulesService.nextOccurrence(schedule.hour, schedule.minute, new Date());
    }
    return this.repo.save(schedule);
  }

  async updateTime(id: number, hour: number, minute: number): Promise<RecurringSchedule> {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error('La hora debe tener el formato HH:MM.');
    }
    const schedule = await this.repo.findOneBy({ id });
    if (!schedule) throw new Error(`Programación #${id} no encontrada.`);
    schedule.hour = hour;
    schedule.minute = minute;
    schedule.nextRunAt = SchedulesService.retimeRun(schedule.nextRunAt, hour, minute, schedule.intervalDays);
    return this.repo.save(schedule);
  }

  async setNextContest(scheduleId: number, contestId: number): Promise<RecurringSchedule> {
    const schedule = await this.repo.findOneBy({ id: scheduleId });
    if (!schedule) throw new Error(`Programación #${scheduleId} no encontrada.`);
    const contest = await this.contestRepo.findOneBy({ id: contestId, scheduleId });
    if (!contest) throw new Error('Concurso no encontrado en esta programación.');
    if (contest.used) throw new Error('Ese concurso ya fue enviado; elige uno que siga en la lista.');
    schedule.nextContestId = contest.id;
    return this.repo.save(schedule);
  }

  /**
   * Resolves the contest the next run will announce, committing it to `nextContestId` so it can be
   * reviewed (and overridden) before it fires. Keeps an existing pick as long as it's still in the
   * pool and unused — re-rolling on every read would make the preview meaningless. Returns null,
   * and clears the pick, when the pool is exhausted.
   */
  private async ensureNextPick(schedule: RecurringSchedule): Promise<RecurringScheduleContest | null> {
    if (schedule.nextContestId != null) {
      const current = await this.contestRepo.findOneBy({ id: schedule.nextContestId, scheduleId: schedule.id, used: false });
      if (current) return current;
    }
    const pool = await this.contestRepo.find({ where: { scheduleId: schedule.id, used: false } });
    const pick = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    schedule.nextContestId = pick ? pick.id : null;
    await this.repo.save(schedule);
    return pick;
  }

  async delete(id: number): Promise<void> {
    const schedule = await this.repo.findOneBy({ id });
    if (!schedule) throw new Error(`Programación #${id} no encontrada.`);
    await this.contestRepo.delete({ scheduleId: id });
    await this.repo.delete(id);
  }

  async addContest(scheduleId: number, platform: string, externalId: string): Promise<RecurringScheduleContest> {
    const schedule = await this.repo.findOneBy({ id: scheduleId });
    if (!schedule) throw new Error(`Programación #${scheduleId} no encontrada.`);

    const existing = await this.contestRepo.findOneBy({ scheduleId, contestPlatform: platform, contestExternalId: externalId });
    if (existing) throw new Error('Este concurso ya está en la lista de esta programación.');

    const contest = await this.contests.getContestById(platform, externalId);
    if (!contest) throw new Error(`No se encontró el concurso "${externalId}" en ${platform}.`);

    const saved = await this.contestRepo.save(
      this.contestRepo.create({
        scheduleId,
        contestPlatform: platform,
        contestExternalId: externalId,
        contestName: contest.name,
        contestUrl: contest.url,
        contestStartTime: contest.startTime,
        contestDurationSeconds: contest.durationSeconds,
        used: false,
      }),
    );

    await this.ensureNextPick(schedule);
    return saved;
  }

  async removeContest(scheduleId: number, contestId: number): Promise<void> {
    const contest = await this.contestRepo.findOneBy({ id: contestId, scheduleId });
    if (!contest) throw new Error('Concurso no encontrado en esta programación.');
    if (contest.used) throw new Error('No se puede quitar un concurso que ya fue enviado.');
    await this.contestRepo.delete(contest.id);

    const schedule = await this.repo.findOneBy({ id: scheduleId });
    if (schedule && schedule.nextContestId === contest.id) await this.ensureNextPick(schedule);
  }

  /**
   * Moves an already-scheduled run to a new time of day, keeping its place in the cadence:
   * the stored run *date* is preserved, only HH:MM changes. If the new time already passed
   * (e.g. moving 15:05 -> 14:55 on the day it fires), the run advances by whole intervals
   * instead of firing immediately — same no-catch-up rule as `setActive`.
   */
  private static retimeRun(current: Date, hour: number, minute: number, intervalDays: number): Date {
    const next = new Date(current);
    next.setUTCHours(hour, minute, 0, 0);
    const now = new Date();
    while (next <= now) next.setUTCDate(next.getUTCDate() + intervalDays);
    return next;
  }

  private static nextOccurrence(hour: number, minute: number, from: Date): Date {
    const next = new Date(from);
    next.setUTCHours(hour, minute, 0, 0);
    if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatch() {
    const due = await this.repo.find({ where: { active: true, nextRunAt: LessThanOrEqual(new Date()) } });
    for (const schedule of due) {
      await this.fireSchedule(schedule);
    }
  }

  private async fireSchedule(schedule: RecurringSchedule) {
    try {
      const pick = await this.ensureNextPick(schedule);

      if (!pick) {
        schedule.active = false;
        await this.repo.save(schedule);
        this.logger.log(`Programación #${schedule.id} detenida: no quedan concursos sin usar en la lista.`);
        return;
      }

      const category = await this.categories.findById(schedule.categoryId);
      if (!category) {
        schedule.active = false;
        await this.repo.save(schedule);
        this.logger.error(`Programación #${schedule.id} detenida: la categoría #${schedule.categoryId} ya no existe.`);
        return;
      }

      await this.announcements.schedule({
        guildId: schedule.guildId ?? undefined,
        categorySlug: category.slug,
        contestPlatform: pick.contestPlatform,
        contestExternalId: pick.contestExternalId,
        contestName: pick.contestName,
        contestUrl: pick.contestUrl,
        contestStartTime: pick.contestStartTime,
        contestDurationSeconds: pick.contestDurationSeconds,
        templateName: schedule.templateName ?? undefined,
        scheduledFor: schedule.nextRunAt,
      });

      pick.used = true;
      pick.usedAt = new Date();
      await this.contestRepo.save(pick);

      schedule.nextRunAt = new Date(schedule.nextRunAt.getTime() + schedule.intervalDays * DAY_MS);
      schedule.nextContestId = null;
      await this.repo.save(schedule);

      // Commit the following run's contest right away, so the panel can show it for a whole cycle.
      const upcoming = await this.ensureNextPick(schedule);

      this.logger.log(
        `Programación #${schedule.id}: enviado "${pick.contestName}", próximo envío ${schedule.nextRunAt.toISOString()}` +
          `${upcoming ? ` con "${upcoming.contestName}"` : ' (lista agotada)'}.`,
      );
    } catch (err) {
      this.logger.error(`Error procesando programación #${schedule.id}: ${err.message}`);
    }
  }
}
