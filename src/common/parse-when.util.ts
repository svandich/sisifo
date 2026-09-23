import { getZonedParts, zonedTimeToUtc } from './timezone.util';

const RELATIVE_PATTERN = /^(\d+)(m|h|d)$/;
const TIME_ONLY_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
// A date (optionally with a time) and *no* offset/Z — read in the configured zone rather than UTC.
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Parses the `cuando` scheduling input. Wall-clock inputs (`HH:MM`, `YYYY-MM-DD HH:MM`) are read in
 * `timeZone`; only inputs that carry their own offset (`...Z`, `...-03:00`) bypass it.
 */
export function parseWhen(input: string, timeZone: string): Date | null {
  const trimmed = input.trim();
  const relative = RELATIVE_PATTERN.exec(trimmed);

  if (relative) {
    const value = parseInt(relative[1], 10);
    const unit = relative[2];
    const ms = unit === 'm' ? value * 60_000 : unit === 'h' ? value * 3_600_000 : value * 86_400_000;
    return new Date(Date.now() + ms);
  }

  const timeOnly = TIME_ONLY_PATTERN.exec(trimmed);
  if (timeOnly) {
    const today = getZonedParts(new Date(), timeZone);
    const d = zonedTimeToUtc(
      {
        year: today.year,
        month: today.month,
        day: today.day,
        hour: parseInt(timeOnly[1], 10),
        minute: parseInt(timeOnly[2], 10),
        second: timeOnly[3] ? parseInt(timeOnly[3], 10) : 0,
      },
      timeZone,
    );
    return isNaN(d.getTime()) ? null : d;
  }

  const localDate = LOCAL_DATE_PATTERN.exec(trimmed);
  if (localDate) {
    const d = zonedTimeToUtc(
      {
        year: parseInt(localDate[1], 10),
        month: parseInt(localDate[2], 10),
        day: parseInt(localDate[3], 10),
        hour: localDate[4] ? parseInt(localDate[4], 10) : 0,
        minute: localDate[5] ? parseInt(localDate[5], 10) : 0,
        second: localDate[6] ? parseInt(localDate[6], 10) : 0,
      },
      timeZone,
    );
    return isNaN(d.getTime()) ? null : d;
  }

  const date = new Date(trimmed);
  return isNaN(date.getTime()) ? null : date;
}
