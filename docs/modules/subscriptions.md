# subscriptions

**Path:** `src/subscriptions/`

## Purpose

Links a Discord channel or Telegram chat/topic to a [category](categories.md). When an announcement fires for a category, [`announcements`](announcements.md) fans it out to every subscription for that category. This is the "where do messages go" table.

## Files

- `subscriptions.service.ts` — `SubscriptionsService`, all CRUD.
- `entities/subscription.entity.ts` — `Subscription` TypeORM entity.
- `subscribe.command.ts` — `SubscribeCommand`, the Discord `/suscripcion agregar|eliminar|lista` slash command. Registered by [`bot`](bot.md). Gated on the Discord **Manage Server** (`ManageGuild`) permission for `agregar`/`eliminar`; `lista` is open to anyone in the guild.
- `subscriptions.module.ts` — registers the entity, imports [`categories`](categories.md) (to validate `categorySlug` on create), provides/exports the service and `SubscribeCommand`.

Creation/deletion is exposed two ways: via [`admin`](admin.md)'s `SubscriptionsController` (any holder of `ADMIN_TOKEN`, cross-server/cross-chat), and via bot commands gated per-server/per-chat — `/suscripcion` on Discord (`ManageGuild` permission) and `/suscribir`/`/desuscribir` on Telegram (chat creator/administrator status, checked in [`telegram`](telegram.md)'s `TelegramService.isAdmin`). Both paths call the same `SubscriptionsService` methods.

## Data model

`Subscription` (table `subscriptions`, unique on `[categoryId, platform, chatId, threadId, adminOnly]`):

| Column | Type | Notes |
|---|---|---|
| `id` | int, PK | |
| `categoryId` | int | FK-by-convention to `Category.id` (no DB-level FK) |
| `platform` | `'discord' \| 'telegram'` | |
| `chatId` | string | Discord channel id, or Telegram chat id |
| `guildId` | string, nullable | Discord only — the guild the channel belongs to. Used to scope role-tag mentions (see [category-tags](category-tags.md)) |
| `threadId` | string, nullable | Telegram only — forum topic id, if the subscription is scoped to a specific topic rather than the whole chat |
| `adminOnly` | boolean, default `false` | See "Admin subscriptions" below |

## Admin subscriptions

A subscription marked `adminOnly: true` receives the **full** contest identity (name, URL) even for `simulacion` categories, where public subscriptions only see timing/duration with the contest name redacted as `???`. This is unrelated to who can *manage* subscriptions (that's gated by the [admin panel](admin.md) login) — it's purely about what a given channel/chat is allowed to see in the message content itself. A single category can have both a public channel and an admin-only channel subscribed.

## Public API

- `subscribeDiscord(guildId, channelId, categorySlug, adminOnly?)` / `unsubscribeDiscord(channelId, categorySlug, adminOnly?)`
- `subscribeTelegram(chatId, categorySlug, threadId?, adminOnly?)` / `unsubscribeTelegram(chatId, categorySlug, threadId?, adminOnly?)`
- `findByCategory(categoryId)` — used by `announcements` dispatch to find who to notify.
- `findByGuild(guildId)` — Discord only, used by `SubscribeCommand`'s `lista` subcommand.
- `findAll()` — used by the admin panel to render the subscriptions table (all platforms, all categories).
- `deleteById(id)` — generic delete used by the admin API's `DELETE /api/subscriptions/:id`; works for both platforms since it doesn't need to know platform-specific lookup keys.

## Dependencies

`CategoriesModule`. Imported by [`announcements`](announcements.md), [`admin`](admin.md), [`bot`](bot.md) (for `SubscribeCommand`), and [`telegram`](telegram.md) (for `/suscribir`/`/desuscribir`).
