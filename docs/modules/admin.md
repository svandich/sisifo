# admin

**Path:** `src/admin/`

## Purpose

The HTTP API behind the admin web panel (`public/`, served by `src/main.ts` — see [app](app.md)). This is where **every** administrative action lives: categories, subscriptions, role/user-tag mentions, templates, and scheduling/cancelling announcements. Channel/chat subscriptions are the one action also reachable outside this module: Discord's [`bot`](bot.md) (`/suscripcion`, `ManageGuild`-gated) and Telegram's [`telegram`](telegram.md) (`/suscribir`/`/desuscribir`, group-admin-gated) let a server/chat's own admins manage their subscriptions without the shared `ADMIN_TOKEN`. Everything else lives only here.

This module is a thin HTTP layer: controllers validate the request shape, delegate to the relevant service (documented in that service's own module doc), and translate thrown errors into HTTP responses. Business logic does **not** belong here — if you're adding a rule about *when* something is allowed, put it in the underlying service, not in a controller.

## Files

| File | Route prefix | Delegates to |
|---|---|---|
| `admin-auth.guard.ts` | — | `AdminAuthGuard`, applied via `@UseGuards` on every controller below |
| `http-error.util.ts` | — | `toHttpError(err)` helper (see "Error handling") |
| `auth.controller.ts` | `/api/auth` | nothing — just proves the guard passes |
| `categories.controller.ts` | `/api/categories` | [`categories`](categories.md) |
| `subscriptions.controller.ts` | `/api/subscriptions` | [`subscriptions`](subscriptions.md) |
| `tags.controller.ts` | `/api/tags` | [`category-tags`](category-tags.md) |
| `templates.controller.ts` | `/api/templates` | [`templates`](templates.md) |
| `announcements.controller.ts` | `/api/announcements` | [`announcements`](announcements.md) |
| `contests.controller.ts` | `/api/contests` | [`contests`](contests.md) |
| `discord.controller.ts` | `/api/discord` | [`discord-client`](discord-client.md) |
| `telegram.controller.ts` | `/api/telegram` | [`telegram`](telegram.md)'s `TelegramRegistryService` |
| `schedules.controller.ts` | `/api/schedules` | [`schedules`](schedules.md) |
| `admin.module.ts` | — | imports every module above and registers all controllers |

The `/api` prefix comes from `app.setGlobalPrefix('api')` in `main.ts`, not from anything in this module.

## Authentication

Single shared secret, no per-user accounts. `AdminAuthGuard` reads `Authorization: Bearer <token>` and compares it (`===`) against `config.getOrThrow<string>('ADMIN_TOKEN')`. There's no session, no expiry, no rate-limiting — the frontend just stores whatever the user typed in `sessionStorage` and resends it as the bearer token on every request. Treat `ADMIN_TOKEN` like a password: anyone with it has full admin access to both Discord and Telegram announcement management. `main.ts` refuses to boot at all if `ADMIN_TOKEN` isn't set.

`POST /api/auth/verify` exists purely so the frontend can validate a token before switching from the login screen to the app shell — it does nothing but return `{ ok: true }` if the guard let the request through.

## Error handling

Controllers wrap service calls in `try { ... } catch (err) { toHttpError(err); }`. `toHttpError` (in `http-error.util.ts`):
- Re-throws Nest `HttpException`s as-is (e.g. `TemplatesService.findOne`'s `NotFoundException` passes through with its real status code).
- Wraps anything else (plain `Error`, thrown by nearly every service in this codebase with a human-readable Spanish message) as a `400 BadRequestException` using `err.message` directly as the response body's `message` field.

The frontend (`public/app.js`) reads `data.message` off any non-2xx JSON response and shows it via a toast — so service-layer error messages are what the admin actually sees. Keep them user-facing when writing new service methods.

## Endpoint reference

All routes below require the `Authorization: Bearer <ADMIN_TOKEN>` header (via `AdminAuthGuard`) except none — every controller in this module is guarded.

| Method | Path | Body / query | Notes |
|---|---|---|---|
| `POST` | `/api/auth/verify` | — | Token check only |
| `GET` | `/api/categories` | — | |
| `POST` | `/api/categories` | `{ displayName, type? }` | `type` defaults to `'normal'` in `CategoriesService.createFromName` |
| `DELETE` | `/api/categories/:slug` | — | No cascade — see [categories](categories.md) notes |
| `GET` | `/api/subscriptions` | — | All platforms, all categories |
| `POST` | `/api/subscriptions/discord` | `{ guildId, channelId, categorySlug, adminOnly? }` | |
| `POST` | `/api/subscriptions/telegram` | `{ chatId, threadId?, categorySlug, adminOnly? }` | `chatId` must come from `/api/telegram/chats` (no free-form Telegram chat lookup) |
| `DELETE` | `/api/subscriptions/:id` | — | Generic by numeric id, works for either platform |
| `GET` | `/api/tags` | — | Both role tags (admin-managed) and user tags (self-managed), all platforms |
| `POST` | `/api/tags/discord/role` | `{ guildId, roleId, categorySlug }` | Role tags only — there's no admin endpoint to add a *user* tag on someone else's behalf |
| `DELETE` | `/api/tags/:id` | — | Works on both role and user tags |
| `GET` | `/api/templates?guildId=` | — | `guildId` required |
| `POST` | `/api/templates` | `{ guildId, name, content }` | |
| `PUT` | `/api/templates/:guildId/:name` | `{ content }` | Name is immutable once created — delete + recreate to rename |
| `DELETE` | `/api/templates/:guildId/:name` | — | |
| `GET` | `/api/announcements` | — | All pending (`sent: false`), globally |
| `POST` | `/api/announcements` | `{ platform, contestId, categorySlug, cuando?, templateName?, guildId? }` | See [announcements](announcements.md) for the full validation/timing rules this triggers |
| `DELETE` | `/api/announcements/:id` | — | Fails if already sent |
| `GET` | `/api/contests/:platform?query=` | — | Omit `query` for "upcoming"; `platform` is `codeforces` or `atcoder` |
| `GET` | `/api/contests/:platform/:id` | — | Single contest lookup |
| `GET` | `/api/discord/guilds` | — | Live from the connected discord.js client — see below |
| `GET` | `/api/telegram/chats` | — | From the tracked-chat registry, not live — see [telegram](telegram.md) |
| `GET` | `/api/schedules` | — | All recurring schedules, each with its pool of contests (`contests: []`) attached |
| `POST` | `/api/schedules` | `{ categorySlug, intervalDays, hour, minute, guildId?, templateName? }` | `categorySlug` must be a `normal`-type category. See [schedules](schedules.md) for validation/timing rules |
| `PATCH` | `/api/schedules/:id` | `{ active }` | Pause/resume |
| `DELETE` | `/api/schedules/:id` | — | Deletes the schedule and its whole contest pool |
| `POST` | `/api/schedules/:id/contests` | `{ platform, externalId }` | Looks up and snapshots the contest into the schedule's pool |
| `DELETE` | `/api/schedules/:id/contests/:contestId` | — | Fails if that pool entry was already used |

## `GET /api/discord/guilds`

Unlike Telegram, discord.js keeps a live cache of every guild the bot is in. This endpoint (`discord.controller.ts`) walks `client.guilds.cache`, and for each guild fetches all channels and roles fresh (`guild.channels.fetch()`, `guild.roles.fetch()` — not the cache, since those can be stale), returning:

```
[{ id, name, channels: [{ id, name }], roles: [{ id, name }] }]
```

Channels are filtered to `ChannelType.GuildText` only (no voice/category/forum channels — subscriptions only make sense for text channels). Roles filter out `@everyone` (`role.id !== guild.id`) and managed/bot-integration roles (`role.managed`). Returns `[]` if the Discord client isn't ready yet rather than erroring — the frontend just shows an empty dropdown.

## Dependencies

Imports every domain module: `CategoriesModule`, `SubscriptionsModule`, `CategoryTagsModule`, `TemplatesModule`, `AnnouncementsModule`, `ContestsModule`, `DiscordClientModule`, `TelegramModule`, `SchedulesModule`. Imported by [`app`](app.md) (`AppModule`) directly — this is a leaf consumer, nothing imports `AdminModule`.

## The frontend

`public/index.html` + `public/app.js` + `public/styles.css` is a hand-written, no-build-step vanilla JS single page that talks to this API. It's not part of `src/` and has no module doc of its own, but changes to any endpoint's request/response shape in this module must be mirrored there — `app.js` hardcodes the shapes above (see e.g. `fillCategorySelects`, `renderSubscriptions`, `loadTemplates`, `renderSchedules`). There's no shared TypeScript types between the two; keep them in sync by hand.
