# bot

**Path:** `src/bot/`

## Purpose

Owns the discord.js `Client` connection and dispatches Discord slash-command interactions. Most administrative Discord actions (categories, role mentions, templates, scheduling) live in the [admin](admin.md) web panel instead. Channel subscriptions are the one exception: they're manageable both from the admin panel *and* per-server via a `ManageGuild`-gated bot command, so a Discord server's own admins can self-serve without needing the shared `ADMIN_TOKEN`.

## Files

- `bot.service.ts` — `BotService`. Creates the discord.js `Client`, registers slash commands with Discord on `clientReady`, and routes incoming `interactionCreate` events to the matching command handler.
- `bot.module.ts` — `BotModule`. Imports [`ContestsModule`](contests.md) (for `ContestCommand`), [`CategoryTagsModule`](category-tags.md) (for `SuscribirmeCommand`), [`SubscriptionsModule`](subscriptions.md) (for `SubscribeCommand`), and [`DiscordClientModule`](discord-client.md).
- `slash-command.interface.ts` — `ISlashCommand`, the contract every slash command class implements: a `data` (the `SlashCommandBuilder`) and `execute(interaction)`.

## Registered commands

| Command | Provided by | Gating |
|---|---|---|
| `/contest` | [`contests`](contests.md) (`ContestCommand`) | none — read-only contest browsing |
| `/suscribirme` | [`category-tags`](category-tags.md) (`SuscribirmeCommand`) | none — self opt-in/opt-out of being mentioned |
| `/suscripcion` | [`subscriptions`](subscriptions.md) (`SubscribeCommand`) | `agregar`/`eliminar` require the `ManageGuild` ("Gestionar Servidor") permission; `lista` is open |

If you're tempted to add a new Discord slash command here, ask first whether it's an admin action — if so, it belongs in the [admin](admin.md) panel/API instead, not as a bot command, unless (like `/suscripcion`) there's a specific reason to also let per-server admins self-serve it without the shared admin token.

## Behavior notes

- `BotService.onModuleInit` calls `discordClientService.set(this.client)` immediately, before login — so `DiscordClientService.get()` can return a non-null (but not-yet-ready) client shortly after boot. Callers should still check `client.isReady()`.
- Slash commands are re-registered with Discord's REST API on every `clientReady` event (i.e. on every reconnect), via `rest.put(Routes.applicationCommands(clientId), ...)`. There's no separate manual registration step.
- Command errors are caught centrally in `handleCommand` and replied with a generic Spanish error message; individual commands can still reply/edit-reply themselves for expected validation errors.

## Dependencies

`ContestsModule`, `CategoryTagsModule`, `SubscriptionsModule`, `DiscordClientModule`.
