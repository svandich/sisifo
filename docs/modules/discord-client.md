# discord-client

**Path:** `src/discord-client/`

## Purpose

Holds a single shared reference to the connected discord.js `Client` so that modules other than [`bot`](bot.md) — namely [`announcements`](announcements.md) (to send messages) and [`admin`](admin.md) (to list guilds/channels/roles for the panel's dropdowns) — can reach it without creating a circular module dependency on `BotModule`.

This module deliberately has **no dependencies of its own** so it can be imported freely from anywhere.

## Files

- `discord-client.service.ts` — `DiscordClientService`. A plain in-memory holder: `set(client)` / `get(): Client | undefined`.
- `discord-client.module.ts` — trivial module providing/exporting the service.

## Public API

- `set(client: Client): void` — called once, by `BotService.onModuleInit`, right after the discord.js `Client` is constructed.
- `get(): Client | undefined` — returns the client, or `undefined` before `bot` has finished initializing (or if Discord isn't configured). Callers must null-check.

## Why this exists

Before this module existed, `AnnouncementsService` had a `setDiscordClient()` method called directly by `BotService`, which meant `AnnouncementsModule` had to be imported by `BotModule` — but `BotModule` no longer needs the rest of `AnnouncementsModule`'s dependency graph (the admin-only commands that used to live in `bot` were removed). Routing the client through this standalone module keeps `bot` and `admin`/`announcements` independent of each other while both reaching the same live client instance.

## Dependencies

None. Imported by `bot`, `announcements`, and `admin`.
