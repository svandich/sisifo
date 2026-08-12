# telegram

**Path:** `src/telegram/`

## Purpose

Telegram-side counterpart to [`bot`](bot.md): owns the `node-telegram-bot-api` polling connection, handles a small set of self-serve commands, sends outgoing announcement messages, and — unlike Discord — has no API for "list every chat the bot is in," so this module also maintains its own lightweight registry of chats/topics the bot has observed, which the [admin panel](admin.md) uses to populate its subscription-target dropdown.

Most administrative actions are self-serve or panel-only, but chat/topic subscriptions can also be managed per-chat via bot commands, gated on Telegram group-admin status (`/suscribir`, `/desuscribir`) — mirroring Discord's `/suscripcion`, so a group's own admins/creator can self-serve without the shared `ADMIN_TOKEN`. This is checked live against Telegram (`bot.getChatMember`), not stored anywhere.

## Files

- `telegram.service.ts` — `TelegramService`. Owns the bot connection, routes incoming messages to command handlers, tracks chats/topics, checks group-admin status for the subscribe commands, and exposes `send()` for outgoing messages.
- `telegram-registry.service.ts` — `TelegramRegistryService`. CRUD-ish tracking of known chats/topics; entirely separate concern from `TelegramService`, split out so [`admin`](admin.md) can depend on just the registry without pulling in the bot connection itself.
- `entities/telegram-chat.entity.ts` — `TelegramChat`.
- `entities/telegram-topic.entity.ts` — `TelegramTopic`.
- `telegram.module.ts` — registers both entities, imports [`categories`](categories.md), [`subscriptions`](subscriptions.md), and [`category-tags`](category-tags.md), provides/exports `TelegramService` and `TelegramRegistryService`.

## Data model

`TelegramChat` (table `telegram_chats`, unique `chatId`):

| Column | Notes |
|---|---|
| `chatId` | Telegram chat id, as a string |
| `title` | Group title, or the user's name/username for DMs, falling back to the raw id |
| `type` | Telegram's own chat type string (`group`, `supergroup`, `channel`, `private`) |
| `updatedAt` | Bumped every time the bot sees a message from this chat |

`TelegramTopic` (table `telegram_topics`, unique `[chatId, threadId]`):

| Column | Notes |
|---|---|
| `chatId`, `threadId` | Which chat + which forum topic |
| `title` | Only populated if the bot happened to see the topic-creation service message (`forum_topic_created.name`); otherwise `null` and the UI falls back to `"Tema {threadId}"` |

**These two tables are a cache built from observed traffic, not a source of truth.** A chat/topic only shows up here after the bot has seen at least one message in it — there's no Telegram Bot API to proactively enumerate "every chat I'm a member of," which is why this exists at all (contrast with [`discord-client`](discord-client.md), which can just ask discord.js for a live list). If the bot is re-added to a chat or a new topic is created, nothing appears in the admin dropdown until *some* message is sent there.

## Commands (`handleMessage`)

Every incoming message is tracked (`trackChat`) before any command routing, regardless of whether it's a command at all — this is how the registry gets populated organically. Recognized commands:

| Command | Description |
|---|---|
| `/categorias` | Lists all categories + slugs (read-only) |
| `/suscribir <slug> [admin]` | Subscribe this chat/topic to a category's announcements. **Requires group-admin or creator status** (`isAdmin`). `admin` flag marks the subscription as admin-only (full contest identity in simulaciones) |
| `/desuscribir <slug> [admin]` | Unsubscribe. Same admin gating |
| `/suscribirme <slug>` | Self opt-in to be `{{tags}}`-mentioned for that category in this chat/topic — mirrors Discord's `/suscribirme`. No gating |
| `/desuscribirme <slug>` | Self opt-out |

`/suscribir`/`/desuscribir` delegate to [`subscriptions`](subscriptions.md)'s `subscribeTelegram`/`unsubscribeTelegram`, scoped to the current chat and (if sent inside a forum topic) `threadId`. `isAdmin(chatId, userId)` calls `bot.getChatMember` on every invocation — no caching, no fallback if that call fails (treated as not-admin).

`/suscribirme`/`/desuscribirme` delegate to [`category-tags`](category-tags.md)'s `addUserTelegram`/`removeUserTelegram`, scoped by `chatId` (not `threadId` — a user's tag opt-in applies to the whole chat, not a specific topic within it).

## Public API

- `send(chatId, text, threadId?): Promise<void>` — used by [`announcements`](announcements.md) dispatch. No-ops silently if the bot isn't configured (`TELEGRAM_TOKEN` unset) or on any send error (logged, not thrown — one failed Telegram send shouldn't block the dispatch loop).

`TelegramRegistryService`:
- `trackChat(chatId, title, type)` / `trackTopic(chatId, threadId, title?)` — upserts.
- `findAllChats()` / `findTopicsForChat(chatId)` — used by [`admin`](admin.md)'s `TelegramController` (`GET /api/telegram/chats`).

## Dependencies

`CategoriesModule`, `SubscriptionsModule`, `CategoryTagsModule` (for `TelegramService`); nothing beyond TypeORM for `TelegramRegistryService`. Imported by [`announcements`](announcements.md) (for `send()`) and [`admin`](admin.md) (for the registry, to list chats/topics).

## Notes

- If `TELEGRAM_TOKEN` isn't set, `onModuleInit` logs a warning and leaves `this.bot` as `null` — every method on `TelegramService` guards on that and becomes a no-op rather than throwing. Telegram support is fully optional.
