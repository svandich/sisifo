const RELATIVE_PATTERN = /^(\d+)(m|h|d)$/;
const TIME_ONLY_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export function parseWhen(input: string): Date | null {
  const relative = RELATIVE_PATTERN.exec(input.trim());

  if (relative) {
    const value = parseInt(relative[1], 10);
    const unit = relative[2];
    const ms = unit === 'm' ? value * 60_000 : unit === 'h' ? value * 3_600_000 : value * 86_400_000;
    return new Date(Date.now() + ms);
  }

  const timeOnly = TIME_ONLY_PATTERN.exec(input.trim());
  if (timeOnly) {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      parseInt(timeOnly[1], 10), parseInt(timeOnly[2], 10), timeOnly[3] ? parseInt(timeOnly[3], 10) : 0));
    return isNaN(d.getTime()) ? null : d;
  }

  const date = new Date(input.trim());
  return isNaN(date.getTime()) ? null : date;
}
