# common

**Path:** `src/common/`

## Purpose

Small, dependency-free pure-function utilities shared across modules. Not a Nest module (no `.module.ts`, nothing injectable) — just plain functions, imported directly wherever needed.

## Files

### `format.util.ts`

| Function | Used by | Notes |
|---|---|---|
| `formatDate(date)` | Discord message rendering | Discord timestamp markup: `` <t:unixSeconds:F> `` — renders as a localized date/time client-side in Discord's UI. Takes no zone *because* of that: every Discord viewer sees their own |
| `formatTime(date)` | Discord message rendering | Same idea, short time format: `` <t:unixSeconds:t> `` |
| `formatDatePlain(date, timeZone)` | Telegram message rendering | Plain text, since Telegram has no client-side timestamp markup: `YYYY-MM-DD HH:MM GMT-3`. The trailing label is the zone's *current* short name, so it flips with DST |
| `formatTimePlain(date, timeZone)` | Telegram message rendering | `HH:MM GMT-3` |
| `formatDuration(seconds)` | both | `"2h 30m"` / `"45m"` / `"3h"` — omits the zero unit |
| `escapeHtml(text)` | Telegram HTML mentions ([category-tags](category-tags.md)) | Escapes `&`, `<`, `>` only — not a general-purpose HTML sanitizer, just enough for wrapping arbitrary user display names in Telegram's `<a>` mention tags |
| `markdownToHtml(text)` | Telegram message rendering ([announcements](announcements.md)) | Converts the small set of markdown-ish syntax templates use (`***bold italic***`, `**bold**`, `*italic*`, `` `code` ``) to Telegram HTML tags. **Order matters**: triple-star must be matched before double/single-star, which is why it's the first replace in the chain — reordering these breaks nested emphasis |

### `parse-when.util.ts`

`parseWhen(input: string, timeZone: string): Date | null` — used by [announcements](announcements.md) to parse the `cuando` scheduling input. Tries, in order:

1. Relative offset: `` /^(\d+)(m|h|d)$/ `` → `Date.now() + offset` (zone-independent)
2. Bare time of day: `` /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/ `` → today's date **in `timeZone`** at that wall-clock time
3. Date with optional time and **no** offset: `` YYYY-MM-DD[ T]HH:MM[:SS] `` → that wall clock in `timeZone` (a bare date means midnight there). This case exists precisely so `new Date()` doesn't silently read it as UTC
4. Falls back to `new Date(input)` — only reached by strings that carry their own offset (`...Z`, `...-03:00`), which by definition don't need the configured zone

Returns `null` (not a thrown error) if nothing matches or the resulting date is invalid — callers are expected to check for `null` and surface their own validation error message.

### `timezone.util.ts`

Zone arithmetic on top of `Intl` — no extra dependency, and nothing reads the process's own `TZ`, so the app behaves identically wherever it runs. The zone itself is never read here; it's always an argument, supplied by [`settings`](settings.md).

| Function | Notes |
|---|---|
| `DEFAULT_TIMEZONE` | `Chile/Continental` — the first-run default |
| `isValidTimeZone(tz)` | Whether ICU knows the zone; the validation behind `SettingsService.setTimezone` |
| `getZonedParts(date, tz)` | Wall-clock `{ year, month, day, hour, minute, second }` in that zone |
| `zonedTimeToUtc(parts, tz)` | The inverse. Two-pass: guess with the offset at the naive instant, then re-read the offset at the guess — that second pass is what makes it right across DST. Field overflow rolls over like `Date.UTC`, so `{ day: p.day + 7 }` is a legitimate way to move a week |
| `withTimeInZone(date, h, m, tz)` | Same calendar day *in that zone*, at `h:m:00` |
| `addDaysInZone(date, n, tz)` | Adds whole days keeping the wall-clock time — a 09:00 run stays 09:00 across a DST change, which `+ n*24h` would shift by an hour |
| `formatDateInZone` / `formatTimeInZone` | `YYYY-MM-DD HH:MM` / `HH:MM` in that zone |
| `timeZoneLabel(date, tz)` | Short name for that instant: `UTC`, `GMT-3`, `EST`… |

Gotchas worth knowing before touching this:

- **Nonexistent wall-clock times** (the hour skipped when clocks spring forward) resolve to one hour *before* what was asked, i.e. the instant just ahead of the jump. Chile jumps at midnight, so only a `00:00` schedule ever notices, on one day a year; the runs after it are back on time. **Ambiguous** times (the repeated hour in autumn) resolve to the first of the two instants.
- Requires a **full-ICU** Node build. The `node:20-alpine` base image has it; a small-icu build would know only `UTC` and every other zone would fail validation.

## Dependencies

None — these stay pure functions with no Nest wiring, which is why the time zone is passed **in** as an argument rather than injected. Callers get it from `SettingsService.getTimezone()` (see [settings](settings.md)). Has no module of its own; import the functions directly by path.
