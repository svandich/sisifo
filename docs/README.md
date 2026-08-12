# Entrenador Sisifo

A NestJS app that schedules and delivers competitive programming contest announcements to Discord channels and Telegram chats, managed through a small web admin panel.

## How it works

1. **Create a category** (in the admin panel) — a named topic with a type: **normal** (upcoming contest) or **simulación** (past contest replayed as practice)
2. **Subscribe channels** (in the admin panel) — link Discord channels or Telegram chats/topics to a category; mark a subscription as **admin** to receive full contest details in simulaciones
3. **Schedule an announcement** (in the admin panel) — pick a contest and a category; the bot sends the message at the right time to every subscriber
4. Optionally, **set up a recurring schedule** (in the admin panel, `normal` categories only) — pick a category, an interval in days, and a fixed UTC hour; build a list of contests, and every cycle the bot announces a random one from that list (without repeats) to everyone subscribed to the category. Once the list runs out, the schedule stops until you add more contests.

Announcements are dispatched every minute via a cron job.

### Category types

| Type | Default send time | Start time shown | Contest identity |
|---|---|---|---|
| `normal` | 30 min before contest start | Actual contest start | Always shown |
| `simulacion` | 5 min before sim start | Sim start (`cuando`) | Hidden from public subs; shown to admin subs |

## Admin web panel

All administrative work — categories, subscriptions, role mentions, templates, and scheduling/cancelling announcements — happens at `http://localhost:3000` (or your `PORT`), authenticated with the `ADMIN_TOKEN` env var. See [setup.md](setup.md).

Discord itself only exposes two self-serve slash commands: `/contest` (browse contests) and `/suscribirme` (opt in/out of being mentioned). Telegram only exposes `/categorias`, `/suscribirme`, and `/desuscribirme` — same self-serve idea, no admin commands on either platform.

## Docs

- [Setup](setup.md) — environment variables, running the bot, the admin panel
- [Commands](commands.md) — full reference for Discord/Telegram commands and the admin panel
