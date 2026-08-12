# category-tags

**Path:** `src/category-tags/`

## Purpose

Manages who/what gets `@mentioned` in an announcement message via the `{{tags}}` template variable — Discord roles or users, or Telegram users. Two very different management flows share one entity and service:

- **Role tags** (Discord only) — admin-managed, added/removed through the [admin panel](admin.md).
- **User tags** — self-managed by end users, via the Discord `/suscribirme` command or Telegram's `/suscribirme` bot command. Any user can opt themselves in/out; there is no admin approval step.

## Files

- `category-tags.service.ts` — `CategoryTagsService`, all CRUD plus the mention-string builders used at send time.
- `entities/category-tag.entity.ts` — `CategoryTag` TypeORM entity.
- `suscribirme.command.ts` — `SuscribirmeCommand`, the Discord `/suscribirme` slash command (self opt-in/opt-out). Registered by [`bot`](bot.md).
- `category-tags.module.ts` — registers the entity, imports [`categories`](categories.md), provides/exports the service and `SuscribirmeCommand`.

## Data model

`CategoryTag` (table `category_tags`, unique on `[categoryId, platform, type, targetId, scopeId]`):

| Column | Type | Notes |
|---|---|---|
| `id` | int, PK | |
| `categoryId` | int | Which category's announcements this mention fires on |
| `platform` | `'discord' \| 'telegram'` | |
| `type` | `'user' \| 'role'` | Roles are Discord-only (admin-managed); users exist on both platforms (self-managed) |
| `targetId` | string | Discord user/role id, or Telegram user id |
| `scopeId` | string, nullable | Discord guild id, or Telegram chat id — mentions are scoped per-server/per-chat, not global |
| `displayName` | string, nullable | Telegram only. Captured at subscribe time (`first_name last_name`) since Telegram mentions need a display name in the `<a href="tg://user?id=...">` HTML link, unlike Discord's `<@id>` mention syntax which resolves client-side |

## Public API

- `addUserDiscord` / `removeUserDiscord` — used by `SuscribirmeCommand`.
- `addRoleDiscord` / `removeRoleDiscord` — used by the [admin](admin.md) `TagsController`.
- `addUserTelegram` / `removeUserTelegram` — used by [`telegram`](telegram.md)'s `/suscribirme`/`/desuscribirme`.
- `buildDiscordMentions(categoryId, guildId): Promise<string>` / `buildTelegramMentions(categoryId, chatId): Promise<string>` — called by [`announcements`](announcements.md) at send time to build the `{{tags}}` value; each returns a space-joined string of mention syntax, empty string if nothing's tagged.
- `findAll()` — used by the admin panel to render the mentions table (roles and self-tagged users, across all guilds/chats).
- `removeById(id)` — generic delete for the admin API; also technically allows an admin to remove a user's self-tag from the panel, which is intentional (gives admins a way to clear stray/abandoned opt-ins).

## Dependencies

`CategoriesModule`. Imported by [`bot`](bot.md) (for `SuscribirmeCommand`), [`announcements`](announcements.md), [`telegram`](telegram.md), and [`admin`](admin.md).

## Notes

- The `{{tags}}` variable only renders anything if the template actually includes it — see [templates](templates.md).
