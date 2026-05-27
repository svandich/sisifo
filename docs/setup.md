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
| `DATABASE_PATH` | No | SQLite file path (default: `./data/sisifo.sqlite`) |
| `TELEGRAM_TOKEN` | No | Token from @BotFather; omit to disable Telegram |

## Install and run

```bash
npm install
npm run start:dev    # development (watch mode)
npm run start:prod   # production
```

The SQLite database file is created automatically under `./data/` on first start.

## Discord — registering slash commands

Slash commands must be registered with Discord before they appear in servers. Run the registration script once after adding the bot to a server:

```bash
npx ts-node src/bot/register-commands.ts
```

> If no registration script exists yet, commands are registered automatically on bot startup via `BotService`.

## Telegram setup

1. Add the bot to a group
2. Promote it to **administrator** (needed to read `getChatMember` for admin checks)
3. Use `/suscribir <slug>` as a group admin to subscribe
