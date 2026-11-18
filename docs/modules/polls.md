# polls

**Path:** `src/polls/`

## Purpose

Recurring **native Telegram polls** for a category: "every Tuesday at 12:00, ask the chats subscribed to `entrenamiento_semanal` *¿Participas mañana?* with *Sí / No*." It exists so organizers know who's coming to a training the day before it happens. Telegram-only. Discord has no equivalent native poll the bot uses.

Deliberately **not** tied to [`schedules`](schedules.md) or [`announcements`](announcements.md). A poll has its own weekday-based cadence instead of being derived from a schedule's `nextRunAt`. Schedules run on an every-N-days interval, can be paused when their pool runs out, and fire at the *announcement* time, not the contest time. Deriving "the day before" from that would be fragile. The admin just picks the weekday(s) the poll goes out. If the training moves, edit the poll too.

## Files

- `polls.service.ts`: `PollsService`. CRUD, validation, the `@Cron(EVERY_MINUTE)` dispatcher, and fan-out to Telegram.
- `entities/recurring-poll.entity.ts`: `RecurringPoll` TypeORM entity.
- `polls.module.ts`: registers the entity and imports [`categories`](categories.md), [`subscriptions`](subscriptions.md), [`telegram`](telegram.md) and [`settings`](settings.md).

Managed only through [`admin`](admin.md)'s `PollsController`. There's no bot command for it.

## Data model

`RecurringPoll` (table `recurring_polls`):

| Column | Notes |
|---|---|
| `id` | int, PK |
| `categoryId` | FK-by-convention to `Category.id`. **Who receives the poll is resolved at send time** from the category's Telegram subscriptions (see "Targets"), not stored on the poll, so moving the subscription moves the poll with it. Any category type is allowed |
| `question` | 1–300 chars (Telegram's limit) |
| `options` | `simple-json` `string[]`, 2–10 entries, each 1–100 chars, trimmed, blanks dropped |
| `weekdays` | `simple-json` `number[]`, `0` = domingo … `6` = sábado, deduped and sorted. Read as the weekday **in the configured time zone**, not UTC |
| `hour`, `minute` | wall clock in the configured zone ([settings](settings.md)) |
| `isAnonymous` | default `false`. The point is seeing *who* answered, so non-anonymous is the default (Telegram's own default is anonymous) |
| `allowsMultipleAnswers` | default `false` |
| `active` | pause/resume. Set to `false` automatically if the category is deleted |
| `nextRunAt` | next scheduled send |
| `lastSentAt` | nullable. Last time the dispatcher actually sent it. The panel's "Enviar ahora" does **not** update it |

## Timing model

`nextOccurrence(weekdays, hour, minute, from, tz)` is the first slot strictly after `from` whose local calendar day is one of `weekdays`, at `hour:minute` local. It's built on [`common`](common.md)'s `zonedTimeToUtc`, so it's DST-correct (12:00 stays 12:00 across Chile's April/September change).

- `create()` uses the next slot from now.
- After each fire, the next slot is computed from *now*, not from the old `nextRunAt`. Downtime therefore never causes a catch-up burst.
- **Any** change to `weekdays` or `hour`/`minute` recomputes from now. Unlike recurring schedules, the weekday set fully defines the cadence, so there's no "place in the cycle" to preserve.
- Resuming a paused poll whose `nextRunAt` already passed recomputes it too.
- `retimeAllForTimezone()` recomputes every poll after the zone changes. It's called by [`admin`](admin.md)'s `SettingsController`, for the same cycle-avoidance reason as `SchedulesService.retimeAllForTimezone()`.

## Dispatch (`dispatch()`, `@Cron(EVERY_MINUTE)`)

1. Loads `active` polls with `nextRunAt <= now`.
2. Advances `nextRunAt` **before** sending. A partial failure must not leave the poll due, or it would re-send every minute to the chats where it did go through. Failed chats are logged and not retried.
3. **Late runs are skipped, not sent.** If the slot is more than 3 hours behind (`MAX_LATENESS_MS`, e.g. the bot was down), it's logged and dropped. A "¿participas mañana?" arriving on the day of the contest is worse than none.
4. Otherwise sends to every target and sets `lastSentAt`.

Unlike [`announcements`](announcements.md), this dispatcher does **not** wait for the Discord client to be ready, since it never touches Discord.

## Targets

Every **non-`adminOnly`** Telegram [subscription](subscriptions.md) of the category, deduped by `(chatId, threadId)`. Topic subscriptions get the poll inside that topic (`message_thread_id`).

- Admin-only subscriptions are skipped. Those chats exist so organizers can see hidden simulación details, not to be asked whether they're attending.
- A chat subscribed both ways gets the poll once, through its public subscription.
- Discord subscriptions are ignored.

## Public API

- `create(dto)` / `update(id, partialDto)` / `delete(id)` / `findAll()`.
- `sendNow(id)`: sends immediately to the current targets without touching `nextRunAt`/`lastSentAt`. Meant for testing from the panel. Throws a user-facing error if there are no targets or nothing went through (e.g. `TELEGRAM_TOKEN` unset, bot removed from the chat).
- `retimeAllForTimezone()`: see above.
- `static nextOccurrence(...)`: pure. Exposed for reuse and testing.

## Dependencies

`CategoriesModule`, `SubscriptionsModule` (targets), `TelegramModule` (`TelegramService.sendPoll`), `SettingsModule` (zone). Imported by [`admin`](admin.md).
