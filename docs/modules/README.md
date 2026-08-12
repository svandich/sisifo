# Module documentation

One file per `src/` directory (plus `app.md` for the root `app.module.ts`/`main.ts` wiring), documenting purpose, data model, public API, and non-obvious behavior for that module. See [`/CLAUDE.md`](../../CLAUDE.md) for when/how these must be read and updated.

| Doc | `src/` path |
|---|---|
| [app](app.md) | `src/app.module.ts`, `src/main.ts` |
| [admin](admin.md) | `src/admin/` |
| [announcements](announcements.md) | `src/announcements/` |
| [bot](bot.md) | `src/bot/` |
| [categories](categories.md) | `src/categories/` |
| [category-tags](category-tags.md) | `src/category-tags/` |
| [common](common.md) | `src/common/` |
| [contests](contests.md) | `src/contests/` |
| [discord-client](discord-client.md) | `src/discord-client/` |
| [schedules](schedules.md) | `src/schedules/` |
| [subscriptions](subscriptions.md) | `src/subscriptions/` |
| [telegram](telegram.md) | `src/telegram/` |
| [templates](templates.md) | `src/templates/` |

These are technical/architecture docs for developers (and Claude) working in the codebase. For end-user documentation (running the bot, using the admin panel, bot commands), see [`../README.md`](../README.md), [`../setup.md`](../setup.md), and [`../commands.md`](../commands.md).
