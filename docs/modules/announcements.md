# announcements

**Path:** `src/announcements/`

## Purpose

The scheduling and dispatch engine. An `Announcement` row is a snapshot of "send this contest info to this category's subscribers at this time." A cron job checks every minute for due announcements and fans each one out to every [subscription](subscriptions.md) of its category, rendering the right [template](templates.md) per subscription and respecting the `simulacion` identity-hiding rule from [categories](categories.md). This is the module most worth reading carefully before changing — it's where nearly every other module's business rules intersect.

## Files

- `announcements.service.ts` — `AnnouncementsService`. Scheduling, validation, the cron dispatcher, and per-subscription message rendering/sending.
- `entities/announcement.entity.ts` — `Announcement` TypeORM entity.
- `announcements.module.ts` — registers the entity, imports [`contests`](contests.md), [`templates`](templates.md), [`categories`](categories.md), [`subscriptions`](subscriptions.md), [`telegram`](telegram.md), [`category-tags`](category-tags.md), [`discord-client`](discord-client.md).

There is no admin/announce command here anymore — scheduling and cancelling happen through [`admin`](admin.md)'s `AnnouncementsController`, which calls straight into this service. [`schedules`](schedules.md) also calls `schedule()` directly (not `scheduleFromContest()`) each time a recurring cycle fires, bypassing the contest-lookup/validation path since it already has a snapshotted contest from its own pool.

## Data model

`Announcement` (table `announcements`):

| Column | Notes |
|---|---|
| `id` | int, PK |
| `guildId` | nullable — **not** "which server scheduled this." Only used to resolve which Discord guild's custom template to load when `templateName` is set (templates are per-guild — see [templates](templates.md)). Unused when `templateName` is empty. Historically this column was named `scheduledByGuildId` and scoped `/anunciar lista` to the calling server; that scoping was removed when the admin panel (a single global view) replaced the per-guild Discord command |
| `categoryId` | which category this fires for |
| `contestPlatform`, `contestExternalId` | which contest, by platform + id |
| `contestName`, `contestUrl`, `contestStartTime`, `contestDurationSeconds` | **snapshot** of the contest, captured at schedule time — see below |
| `templateName` | nullable — a `normal`-category custom template name; ignored for `simulacion` categories |
| `scheduledFor` | when the cron dispatcher should send this |
| `simulationStartTime` | nullable — see "Timing rules" below |
| `sent`, `sentAt` | dispatch bookkeeping |

**Why the contest fields are a snapshot, not a live lookup:** dispatch (`sendAnnouncement`) never calls back out to [`contests`](contests.md)/the Codeforces/AtCoder APIs. Everything needed to render the message was captured once, at `schedule()` time. This means dispatch keeps working even if the upstream contest API is down or the contest listing has since changed.

## Timing rules (the part most worth re-reading before changing)

`scheduleFromContest()` (called by the admin API) replicates what used to be the Discord `/anunciar programar` command's validation:

- **`simulacion` category**: `cuando` is **required** and means *the simulation's start time*. `scheduledFor` (when the message actually sends) is always computed as `cuando - 5 minutes`. `simulationStartTime` is set to the parsed `cuando`.
- **`normal` category, contest still `UPCOMING`, no `cuando` given**: defaults `scheduledFor` to `contest.startTime - 30 minutes`.
- **`normal` category, `cuando` given, contest still `UPCOMING`**: `scheduledFor` = parsed `cuando` directly (no offset).
- **`normal` category, `cuando` given, contest NOT `UPCOMING`** (i.e. scheduling a Virtual Participation reminder for a contest that already ran): `cuando` is treated as *the VP time*, `scheduledFor` = `cuando - 5 minutes`, and `simulationStartTime` is set to the parsed `cuando` (reused as "the time to tell people to press VP-start", not an actual simulation).
- **`normal` category, contest NOT `UPCOMING`, no `cuando`**: rejected — there's no sensible default.
- Always rejected if the computed `scheduledFor` is in the past.

`parseWhen()` (see [common](common.md)) accepts a bare `HH:MM` time (today, UTC), full ISO 8601, or a relative offset (`30m`, `2h`, `1d`).

## Dispatch (`dispatch()`, `@Cron(EVERY_MINUTE)`)

1. No-ops if the Discord client isn't ready yet (via [`discord-client`](discord-client.md)) — Telegram-only announcements still wait on this, which is a known limitation, not a deliberate Telegram-only fast path.
2. Loads every `sent: false` announcement with `scheduledFor <= now`.
3. For each, calls `sendAnnouncement`, which:
   - Resolves `isSimulacion` from the category.
   - Computes `isVirtual`: `normal` category + the snapshotted `contestStartTime <= scheduledFor` (i.e. the announcement fires at/after the contest's real start — this is the VP-reminder case from the timing rules above). When true, falls back to `DEFAULT_VIRTUAL_TEMPLATE` if no custom template resolves.
   - For **every** subscription of the category (both platforms, mixed together), builds template variables and renders per-subscription:
     - `includeIdentity = !isSimulacion || sub.adminOnly` — this is the actual enforcement point of the "hide contest identity" rule. When false, `contest_name`/`platform` become the literal string `"???"` and `contest_url` becomes empty.
     - `simulacion` categories always use the hardcoded `DEFAULT_SIMULACION_ADMIN_TEMPLATE`/`DEFAULT_SIMULACION_PUBLIC_TEMPLATE` — a per-guild custom `templateName` is never consulted for these, even if one was set on the announcement (it can't be, since `scheduleFromContest` never lets you set `templateName` for a `simulacion` category through the admin UI's normal flow, but nothing enforces that at the service level if called directly).
     - `normal` categories render via `templates.renderTemplate(announcement.guildId, announcement.templateName, vars, normalFallback)`.
     - `{{tags}}` is built separately per-subscription via [`category-tags`](category-tags.md) (`buildDiscordMentions`/`buildTelegramMentions`), scoped to `sub.guildId`/`sub.chatId`, then prepended to the message body (Discord: `${tags}\n${msg}`) rather than substituted inline — even though `{{tags}}` is also a valid template placeholder.
   - Discord sends via `client.channels.fetch(sub.chatId)`, silently skipping if the channel isn't a `TextChannel` (e.g. it was deleted, or fetch failed).
   - Telegram sends via [`telegram`](telegram.md)'s `send()`, converting rendered markdown-ish syntax to Telegram HTML first (`markdownToHtml`, see [common](common.md)).
   - Marks the announcement `sent` regardless of whether every individual send succeeded — a failure sending to one subscription doesn't block others, but a thrown error anywhere in `sendAnnouncement` is caught and logged, and in that case `markSent` is **not** reached, so the announcement stays `sent: false` and will be retried (and re-sent to everyone) on the next cron tick.

## Public API

- `schedule(dto: ScheduleAnnouncementDto)` — low-level insert, no validation beyond the category existing. Used internally by `scheduleFromContest`.
- `scheduleFromContest(dto: ScheduleFromContestDto)` — what the [admin API](admin.md) calls; does the contest lookup + all validation described above.
- `listPending()` — all `sent: false`, ordered by `scheduledFor`. Global, not guild-scoped (unlike the old Discord command).
- `cancel(id)` — throws if not found or already sent.

## Dependencies

`ContestsModule`, `TemplatesModule`, `CategoriesModule`, `SubscriptionsModule`, `TelegramModule`, `CategoryTagsModule`, `DiscordClientModule`. Imported by [`admin`](admin.md) and [`schedules`](schedules.md).
