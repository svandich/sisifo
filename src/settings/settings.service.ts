import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { DEFAULT_TIMEZONE, isValidTimeZone, timeZoneLabel } from '../common/timezone.util';

export const TIMEZONE_KEY = 'timezone';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  /**
   * Cached so callers can read the zone synchronously (message rendering and the schedule
   * dispatcher run on hot paths and would otherwise hit the DB per announcement). Kept in sync
   * by `setTimezone`, which is the only writer.
   */
  private timezone = DEFAULT_TIMEZONE;

  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
    private readonly config: ConfigService,
  ) {}

  /** First run seeds the row from `TIMEZONE` (or the default); later boots just load what's stored. */
  async onModuleInit(): Promise<void> {
    const stored = await this.repo.findOneBy({ key: TIMEZONE_KEY });

    if (stored && isValidTimeZone(stored.value)) {
      this.timezone = stored.value;
      this.logger.log(`Zona horaria: ${this.timezone}`);
      return;
    }

    const configured = this.config.get<string>('TIMEZONE')?.trim();
    if (configured && !isValidTimeZone(configured)) {
      this.logger.warn(`TIMEZONE="${configured}" no es una zona horaria IANA válida; se usará ${DEFAULT_TIMEZONE}.`);
    }
    if (stored && !isValidTimeZone(stored.value)) {
      this.logger.warn(`La zona horaria guardada ("${stored.value}") ya no es válida; se restablece.`);
    }

    this.timezone = configured && isValidTimeZone(configured) ? configured : DEFAULT_TIMEZONE;
    await this.repo.save(this.repo.create({ key: TIMEZONE_KEY, value: this.timezone }));
    this.logger.log(`Zona horaria inicializada en ${this.timezone}.`);
  }

  /** The IANA zone every stored instant is displayed in, and every typed wall-clock time is read in. */
  getTimezone(): string {
    return this.timezone;
  }

  async setTimezone(timeZone: string): Promise<string> {
    const value = timeZone?.trim();
    if (!isValidTimeZone(value)) {
      throw new Error(`"${timeZone}" no es una zona horaria válida (usa un nombre IANA, por ejemplo "America/Santiago").`);
    }
    await this.repo.save(this.repo.create({ key: TIMEZONE_KEY, value }));
    this.timezone = value;
    this.logger.log(`Zona horaria cambiada a ${value}.`);
    return value;
  }

  /** What the admin panel shows: the zone plus its current short name (`GMT-3`, `UTC`, …). */
  describe(): { timezone: string; label: string; now: string } {
    const now = new Date();
    return { timezone: this.timezone, label: timeZoneLabel(now, this.timezone), now: now.toISOString() };
  }
}
