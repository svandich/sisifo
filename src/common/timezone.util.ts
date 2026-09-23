/**
 * Time-zone arithmetic built on `Intl` only (no extra dependency, no server-local-time reliance:
 * the process can run under any `TZ` and results are identical). Every function here takes the
 * configured IANA zone explicitly — the app's zone lives in the database, see `settings`.
 */

/** Zone used on first run when nothing is stored and `TIMEZONE` isn't set. */
export const DEFAULT_TIMEZONE = 'Chile/Continental';

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
const labelFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function labelFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = labelFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' });
    labelFormatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock fields of `date` as seen in `timeZone`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour') % 24, // some ICU builds render midnight as 24 under h23
    minute: value('minute'),
    second: value('second'),
  };
}

/** How far ahead of UTC `timeZone` is at `date`, in milliseconds (negative west of Greenwich). */
function offsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant at which `timeZone`'s wall clock reads `parts`. Two passes: the first guess uses the
 * offset in effect at the naive UTC instant, the second re-reads the offset at that guess, which is
 * what makes it correct across DST transitions. Ambiguous local times (the repeated hour when the
 * clock falls back) resolve to the first of the two instants; times that don't exist at all (the
 * skipped hour when it springs forward) resolve to one hour *before* the requested wall clock,
 * i.e. the instant just ahead of the jump. Chile jumps at midnight, so that only ever affects a
 * 00:00 schedule, on the one day a year it happens — the runs after it are back on time.
 *
 * Out-of-range fields roll over the same way `Date.UTC` handles them, so `{ day: 32 }` or
 * `{ day: 0 }` is a valid way to move a date by ±1 day.
 */
export function zonedTimeToUtc(parts: Partial<ZonedParts> & Pick<ZonedParts, 'year' | 'month' | 'day'>, timeZone: string): Date {
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0);
  const firstGuess = wallClock - offsetMs(new Date(wallClock), timeZone);
  return new Date(wallClock - offsetMs(new Date(firstGuess), timeZone));
}

/** Same calendar day in `timeZone`, at `hour:minute:00`. */
export function withTimeInZone(date: Date, hour: number, minute: number, timeZone: string): Date {
  const p = getZonedParts(date, timeZone);
  return zonedTimeToUtc({ year: p.year, month: p.month, day: p.day, hour, minute, second: 0 }, timeZone);
}

/**
 * Adds whole days keeping the wall-clock time of day in `timeZone` — a 09:00 run stays at 09:00
 * across a DST change, which plain `+ 24h` arithmetic would shift by an hour.
 */
export function addDaysInZone(date: Date, days: number, timeZone: string): Date {
  const p = getZonedParts(date, timeZone);
  return zonedTimeToUtc({ ...p, day: p.day + days }, timeZone);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `YYYY-MM-DD HH:MM` as read in `timeZone`. */
export function formatDateInZone(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** `HH:MM` as read in `timeZone`. */
export function formatTimeInZone(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Short zone name for the instant: `UTC`, `GMT-3`, `EST`… — DST-aware, so it flips with the offset. */
export function timeZoneLabel(date: Date, timeZone: string): string {
  const part = labelFormatter(timeZone).formatToParts(date).find((p) => p.type === 'timeZoneName');
  return part?.value ?? timeZone;
}
