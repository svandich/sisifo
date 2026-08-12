# common

**Path:** `src/common/`

## Purpose

Small, dependency-free pure-function utilities shared across modules. Not a Nest module (no `.module.ts`, nothing injectable) — just plain functions, imported directly wherever needed.

## Files

### `format.util.ts`

| Function | Used by | Notes |
|---|---|---|
| `formatDate(date)` | Discord message rendering | Discord timestamp markup: `` <t:unixSeconds:F> `` — renders as a localized date/time client-side in Discord's UI |
| `formatTime(date)` | Discord message rendering | Same idea, short time format: `` <t:unixSeconds:t> `` |
| `formatDatePlain(date)` | Telegram message rendering | Plain text, since Telegram has no client-side timestamp markup: `YYYY-MM-DD HH:MM UTC` |
| `formatTimePlain(date)` | Telegram message rendering | `HH:MM UTC` |
| `formatDuration(seconds)` | both | `"2h 30m"` / `"45m"` / `"3h"` — omits the zero unit |
| `escapeHtml(text)` | Telegram HTML mentions ([category-tags](category-tags.md)) | Escapes `&`, `<`, `>` only — not a general-purpose HTML sanitizer, just enough for wrapping arbitrary user display names in Telegram's `<a>` mention tags |
| `markdownToHtml(text)` | Telegram message rendering ([announcements](announcements.md)) | Converts the small set of markdown-ish syntax templates use (`***bold italic***`, `**bold**`, `*italic*`, `` `code` ``) to Telegram HTML tags. **Order matters**: triple-star must be matched before double/single-star, which is why it's the first replace in the chain — reordering these breaks nested emphasis |

### `parse-when.util.ts`

`parseWhen(input: string): Date | null` — used by [announcements](announcements.md) to parse the `cuando` scheduling input. Tries, in order:

1. Relative offset: `` /^(\d+)(m|h|d)$/ `` → `Date.now() + offset`
2. Bare time of day: `` /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/ `` → today's date (UTC) at that time
3. Falls back to `new Date(input)` (handles full ISO 8601 and anything else `Date` can parse)

Returns `null` (not a thrown error) if nothing matches or the resulting date is invalid — callers are expected to check for `null` and surface their own validation error message.

## Dependencies

None. Has no module of its own; import the functions directly by path.
