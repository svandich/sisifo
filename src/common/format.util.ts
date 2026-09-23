import { formatDateInZone, formatTimeInZone, timeZoneLabel } from './timezone.util';

// Discord renders <t:...> markup in each viewer's own timezone, so these two need no zone argument.
export function formatDate(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

export function formatTime(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:t>`;
}

// Telegram has no client-side timestamp markup, so these render in the configured zone (see settings).
export function formatDatePlain(date: Date, timeZone: string): string {
  return `${formatDateInZone(date, timeZone)} ${timeZoneLabel(date, timeZone)}`;
}

export function formatTimePlain(date: Date, timeZone: string): string {
  return `${formatTimeInZone(date, timeZone)} ${timeZoneLabel(date, timeZone)}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function markdownToHtml(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/gs, '<b><i>$1</i></b>')
    .replace(/\*\*(.+?)\*\*/gs, '<b>$1</b>')
    .replace(/\*(.+?)\*/gs, '<i>$1</i>')
    .replace(/`(.+?)`/gs, '<code>$1</code>');
}
