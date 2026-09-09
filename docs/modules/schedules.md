# schedules

**Path:** `src/schedules/`

## Purpose

Recurring, category-wide announcements: "every N days, at a fixed UTC hour, announce a random not-yet-used contest from this hand-picked list." Distinct from [`announcements`](announcements.md), which is one-shot (a specific contest, a specific send time). This module owns the recurrence and the "don't repeat contests" bookkeeping; when a cycle fires, it hands off to `AnnouncementsService.schedule()` to actually create the one-shot `Announcement` row that the existing dispatch cron sends — no duplicate send logic.

## Files

- `schedules.service.ts` — `SchedulesService`: CRUD for schedules and their contest pools, plus the `@Cron(EVERY_MINUTE)` dispatcher that fires due schedules.
- `entities/recurring-schedule.entity.ts` — `RecurringSchedule` TypeORM entity.
- `entities/recurring-schedule-contest.entity.ts` — `RecurringScheduleContest` TypeORM entity (the pool).
- `schedules.module.ts` — registers both entities, imports [`categories`](categories.md), [`contests`](contests.md), [`announcements`](announcements.md), [`templates`](templates.md).

Scheduling/managing happens only through [`admin`](admin.md)'s `SchedulesController` — there's no bot command for this.

## Data model

`RecurringSchedule` (table `recurring_schedules`) — one per category, not per subscription: all subscribers of the category receive whatever contest gets picked each cycle.

| Column | Notes |
|---|---|
| `id` | int, PK |
| `categoryId` | FK-by-convention to `Category.id`. Must be a **`normal`**-type category — `simulacion`'s timing rules (explicit `cuando`, identity redaction tied to a specific simulated start time) don't fit a schedule that picks a contest automatically, so `create()` rejects `simulacion` categories |
| `guildId` | nullable — same role as `Announcement.guildId`: which Discord guild's custom template to resolve, if `templateName` is set |
| `templateName` | nullable — passed straight through to each fired `Announcement` |
| `intervalDays` | integer ≥ 1 |
| `hour`, `minute` | 0-23 / 0-59, UTC — the fixed wall-clock send time |
| `active` | default `true`. Set to `false` automatically by the dispatcher once the pool has no unused contests left — schedules do **not** auto-reset; an admin must add more contests and reactivate |
| `nextRunAt` | when the dispatcher should fire this schedule next |
| `nextContestId` | nullable FK-by-convention to `RecurringScheduleContest.id` — the contest the next run will announce, **committed in advance** instead of drawn at fire time, so an admin can review it and swap or remove it before it goes out. `null` only when the pool has no unused entries left |

`RecurringScheduleContest` (table `recurring_schedule_contests`, unique on `[scheduleId, contestPlatform, contestExternalId]`) — the manually curated pool a schedule draws from.

| Column | Notes |
|---|---|
| `id` | int, PK |
| `scheduleId` | FK-by-convention to `RecurringSchedule.id` |
| `contestPlatform`, `contestExternalId` | which contest |
| `contestName`, `contestUrl`, `contestStartTime`, `contestDurationSeconds` | **snapshot** captured when added to the pool (via `ContestsService.getContestById`), same rationale as `Announcement`'s snapshot fields — see [announcements](announcements.md) |
| `used`, `usedAt` | set once this entry has been picked and handed off to `AnnouncementsService.schedule()` |

## Timing model

Fixed wall-clock cadence, not contest-relative: a schedule fires at `nextRunAt` regardless of the picked contest's own start time (the picked contest might already be `FINISHED` by the time it's randomly drawn from the pool — that's expected, not a bug; `AnnouncementsService`'s existing "VP reminder" fallback template handles that case the same way it does for manually-scheduled past contests).

- On `create()`, `nextRunAt` is the next occurrence of `hour:minute` (today if it hasn't passed yet, otherwise tomorrow).
- After each fire, `nextRunAt += intervalDays` (plain UTC millisecond arithmetic — no DST to account for since everything here is UTC, consistent with `parseWhen`'s `HH:MM` handling elsewhere in the codebase).
- Reactivating a paused/stopped schedule (`setActive(id, true)`) recomputes `nextRunAt` to the next occurrence if the stored one has already passed, so resuming doesn't trigger a burst of catch-up sends.
- Editing the time (`updateTime(id, hour, minute)`) keeps the pending run's **date** and only replaces its time of day, so changing the hour never shifts a weekly schedule onto a different weekday. If the new time already passed today (e.g. moving 15:05 → 14:55 on the very day it fires), `nextRunAt` advances by whole `intervalDays` steps until it's in the future — same no-catch-up rule as `setActive`, so retiming a schedule can never make it fire immediately.

## Picking the contest (`ensureNextPick`)

The random draw happens **ahead of the run, not during it**. `ensureNextPick(schedule)` resolves `nextContestId`: it keeps whatever pick is already stored as long as that entry still exists in the pool and is still unused, and only draws a fresh one (uniformly at random from the unused entries) when there's no valid pick. That "keep if valid" rule is the whole point — re-rolling on every read would make the preview the admin sees meaningless, since the contest shown would differ from the one that eventually sends.

It's called from `findAll()` (so the panel always has a pick to display, and rows predating this column heal themselves on first read), from `addContest` (fills the slot when the pool was empty), from `removeContest` (only when the removed entry *was* the pick), and twice in `fireSchedule` — once to get the contest to send, then again right after, so the following cycle's pick is visible for the whole interval rather than materializing at the last minute.

`setNextContest(id, contestId)` lets an admin override the draw with any unused entry of that schedule's own pool.

## Dispatch (`dispatch()`, `@Cron(EVERY_MINUTE)`)

1. Loads every `active: true` schedule with `nextRunAt <= now`.
2. For each: resolves its pick via `ensureNextPick`.
   - **Pool empty** (no pick) → sets `active: false` and stops (see "Stop" behavior above — no auto-reset).
   - **Otherwise** → calls `AnnouncementsService.schedule()` with `scheduledFor: schedule.nextRunAt` and the picked contest's snapshot, marks the pool entry `used`, advances `nextRunAt`, clears `nextContestId` and immediately commits the next one.
3. A schedule whose category was deleted out from under it is also stopped (`active: false`) rather than throwing repeatedly every minute.

## Public API

- `create(dto)` — validates category type/interval/hour/minute/template, computes initial `nextRunAt`.
- `findAll()` — all schedules with their pool contests attached (`contests: RecurringScheduleContest[]`), for the admin panel.
- `setActive(id, active)` — pause/resume.
- `updateTime(id, hour, minute)` — changes the send time of an existing schedule and recomputes `nextRunAt` per the rule above. Exists so the admin panel can retime a schedule without `delete()` + `create()`, which would destroy the contest pool along with its `used` bookkeeping (already-announced contests would become eligible again).
- `delete(id)` — deletes the schedule and its entire pool.
- `addContest(scheduleId, platform, externalId)` — looks up the contest via [`contests`](contests.md), snapshots it into the pool. Rejects duplicates.
- `removeContest(scheduleId, contestId)` — only if not yet `used`. Re-draws `nextContestId` if the removed entry was the pending pick.
- `setNextContest(scheduleId, contestId)` — overrides which pool entry the next run announces. Rejects entries belonging to another schedule, and ones already `used`.

## Dependencies

`CategoriesModule`, `ContestsModule`, `AnnouncementsModule` (for `schedule()`), `TemplatesModule` (to validate `templateName` exists before saving). Imported by [`admin`](admin.md).
