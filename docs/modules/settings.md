# settings

**Path:** `src/settings/`

## Purpose

App-wide configuration that lives in the database instead of the environment, so it can be changed from the admin panel without a redeploy. Right now it holds exactly one thing: **the time zone** every wall-clock time in the app is read and displayed in.

Why a database row and not just an env var: the zone has to be editable by whoever runs the panel (env vars mean editing `sisifo.env` and restarting the container), and it has to be stable across restarts even if the host's `TZ` changes. `TIMEZONE` in the environment still exists, but only as the **first-run seed** — once the row is written, the env var is ignored.

## Data model

`Setting` (table `settings`) — a generic key/value store, so future settings don't need a new table:

| Column | Notes |
|---|---|
| `key` | PK, string. Known keys: `timezone` (exported as `TIMEZONE_KEY`) |
| `value` | string; always stored as text, parsed by whoever owns the key |

## Public API

`SettingsService`:

- `getTimezone(): string` — **synchronous**, reads an in-memory cache. Deliberate: `announcements`' dispatcher renders every message with it and `schedules` recomputes run times with it, and neither should hit the DB per row. The cache is written by `onModuleInit` and by `setTimezone`, the only writer.
- `setTimezone(tz)` — validates the zone (`isValidTimeZone`, i.e. whether ICU knows it), persists, updates the cache. Throws a user-facing Spanish error for an unknown zone.
- `describe()` — `{ timezone, label, now }` for the admin panel; `label` is the zone's current short name (`GMT-3`, `UTC`, …), which flips with DST.

## Behavior notes

- **First run** (`onModuleInit`): if there's no `timezone` row, one is written from `TIMEZONE` in the environment, or `DEFAULT_TIMEZONE` (`Chile/Continental`) when that's unset or invalid. Later boots just load the stored value. An invalid stored value (e.g. a zone ICU dropped) is logged and reset the same way rather than crashing the app.
- Validation accepts anything ICU accepts, which includes legacy aliases: `Chile/Continental` is the default and resolves to `America/Santiago`. The string is stored **as typed**, not canonicalized, so the panel shows back what the admin entered.
- This module requires a Node build with full ICU. The official `node:20-alpine` image (what the `Dockerfile` uses) ships it; a hand-built small-icu Node would silently only know `UTC`, and `setTimezone` would reject everything else.
- Changing the zone does **not** move already-scheduled one-shot [`announcements`](announcements.md) — those store an absolute instant, which is still the same instant; only its rendering changes. Recurring [`schedules`](schedules.md) *are* re-anchored, because they store a wall-clock `hour`/`minute`; see below.

## Who uses the time zone

| Consumer | What it does with it |
|---|---|
| [`common`](common.md) `parseWhen` | Reads `HH:MM` and `YYYY-MM-DD HH:MM` inputs as wall clock in this zone |
| [`common`](common.md) `formatDatePlain`/`formatTimePlain` | Renders Telegram timestamps in this zone, with its short label appended |
| [`announcements`](announcements.md) | Passes it into both of the above |
| [`schedules`](schedules.md) | `hour`/`minute` are wall clock in this zone; all `nextRunAt` math happens there (DST-aware) |
| [`admin`](admin.md) `SettingsController` | `GET`/`PUT /api/settings`, and the panel renders every date in this zone |

Discord messages are **not** on this list: `formatDate`/`formatTime` emit `<t:…>` markup that Discord renders in each viewer's own zone, so they're zone-independent by construction.

## Dependencies

`TypeOrmModule.forFeature([Setting])` and `ConfigService` (for the `TIMEZONE` seed). Depends on no other domain module — deliberately, since [`announcements`](announcements.md), [`schedules`](schedules.md) and [`admin`](admin.md) all import it, and anything it imported back would be a cycle. That's also why "changing the zone retimes recurring schedules" lives in `SchedulesService.retimeAllForTimezone()` (called by the admin controller after `setTimezone`) instead of inside this service.
