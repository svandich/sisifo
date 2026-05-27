const RELATIVE_PATTERN = /^(\d+)(m|h|d)$/;

export function parseWhen(input: string): Date | null {
  const relative = RELATIVE_PATTERN.exec(input.trim());

  if (relative) {
    const value = parseInt(relative[1], 10);
    const unit = relative[2];
    const ms = unit === 'm' ? value * 60_000 : unit === 'h' ? value * 3_600_000 : value * 86_400_000;
    return new Date(Date.now() + ms);
  }

  const date = new Date(input.trim());
  return isNaN(date.getTime()) ? null : date;
}
