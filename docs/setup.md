# Setup

## Requirements

- Node.js 20+
- A Discord application with a bot token
- (Optional) A Telegram bot token from @BotFather

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Application ID, used to register slash commands |
| `ADMIN_TOKEN` | Yes | Long random secret used to log into the admin web panel |
| `DATABASE_PATH` | No | SQLite file path (default: `./data/sisifo.sqlite`) |
| `TELEGRAM_TOKEN` | No | Token from @BotFather; omit to disable Telegram |
| `PORT` | No | HTTP port for the admin panel/API (default: `3000`) |

## Install and run

```bash
npm install
npm run start:dev    # development (watch mode)
npm run start:prod   # production
```

The SQLite database file is created automatically under `./data/` on first start.

The admin web panel is served at `http://localhost:3000` (or whatever `PORT` is set to). Log in with the value of `ADMIN_TOKEN`.

## Discord — registering slash commands

Slash commands are registered automatically on bot startup via `BotService`. Only two remain: `/contest` (browse contests) and `/suscribirme` (self-serve opt-in to be mentioned in announcements). All administrative actions — categories, channel subscriptions, role mentions, templates, scheduling announcements — are done through the admin web panel, not Discord.

## Telegram setup

1. Add the bot to a group (or forum) — no special admin role needed for the bot itself anymore
2. Send any message (or `/categorias`) in the group, and in each topic you plan to use, so it's registered as a known chat/topic
3. In the admin web panel's Subscriptions tab, switch the platform to Telegram and pick that chat/topic from the dropdown

Telegram's admin subscribe/unsubscribe commands (`/suscribir`, `/desuscribir`) have been removed, same as Discord's — all chat/topic subscriptions are managed from the web panel now. Only the self-serve `/suscribirme`, `/desuscribirme`, and `/categorias` commands remain on Telegram.
