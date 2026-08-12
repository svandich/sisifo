# Command Reference

Most administrative actions (categories, role mentions, templates, scheduling announcements) are managed through the **admin web panel**, not bot commands. Log in at `http://localhost:3000` (or your configured `PORT`) with the `ADMIN_TOKEN` value. See [setup.md](setup.md).

Chat/channel subscriptions are the exception: they can be managed from the admin panel *or* directly from each platform, gated by that platform's own notion of "admin" (Discord's **Manage Server** permission, Telegram's group-admin/creator status) — no `ADMIN_TOKEN` needed for that. Every other bot command is self-serve/read-only and requires no permission at all.

---

## Discord slash commands

### `/contest` — browse contests

| Subcommand | Options | Description |
|---|---|---|
| `upcoming` | `platform` | List upcoming contests (up to 5) |
| `search` | `platform`, `query` | Search contests by name |
| `info` | `platform`, `id` | Show details for a specific contest |

Supported platforms: `codeforces`, `atcoder`.

### `/suscripcion` — manage channel subscriptions (requires **Manage Server**)

| Subcommand | Options | Description |
|---|---|---|
| `agregar` | `categoria`, `canal?`, `admin?` | Subscribe a channel (default: the current one) to a category. `admin` marks it as an admin channel (full contest details in simulaciones) |
| `eliminar` | `categoria`, `canal?`, `admin?` | Unsubscribe a channel |
| `lista` | — | List this server's active subscriptions (no permission required) |

`agregar`/`eliminar` require the **Manage Server** permission; anyone can run `lista`.

### `/suscribirme` — subscribe yourself to be tagged

Any user can run this to opt-in to being mentioned when announcements for a category fire in this server.

| Subcommand | Options | Description |
|---|---|---|
| `agregar` | `categoria` | Start being mentioned in announcements for this category |
| `eliminar` | `categoria` | Stop being mentioned |

The template must include `{{tags}}` for the mention to appear.

---

## Telegram commands

| Command | Description |
|---|---|
| `/categorias` | List all categories and their slugs |
| `/suscribir <slug> [admin]` | Subscribe this chat (or forum topic) to a category. **Requires group-admin or creator status.** `admin` marks it as an admin subscription |
| `/desuscribir <slug> [admin]` | Unsubscribe. Same admin gating |
| `/suscribirme <slug>` | Opt-in to be mentioned when announcements for a category fire in this chat |
| `/desuscribirme <slug>` | Opt-out of being mentioned |

Send these in any chat the bot is in. If sent inside a **forum topic**, `/suscribir`/`/desuscribir` and the opt-in commands are scoped to that thread. The template must include `{{tags}}` for individual Telegram mentions to appear; mentions use each user's display name as recorded at subscribe time.

Any message the bot sees (from any chat/topic it's a member of) also registers that chat/topic in the admin panel's "known chats" list, so it can be picked from a dropdown when creating a subscription from the panel instead.

---

## Admin web panel

Most of the below used to be admin-gated bot commands (Discord's **Manage Server** permission, Telegram's group-admin status) and now live only in the web panel. Subscriptions are the exception — they're reachable from both the panel (any `ADMIN_TOKEN` holder, any server/chat) and the bot commands above (scoped to a server/chat's own admins).

| Section | What it does |
|---|---|
| Categories | Create/delete announcement categories (**normal** — upcoming contest, or **simulación** — hidden contest identity until admin-only channels) |
| Subscriptions | Link a Discord channel or Telegram chat/topic to a category, optionally as an **admin** subscription (receives full contest details in simulaciones) — also doable via `/suscripcion` / `/suscribir` above |
| Menciones (Tags) | Make a Discord role taggable in a category's announcements |
| Templates | Create/edit/delete per-server (Discord guild) message templates |
| Announcements | Browse Codeforces/AtCoder contests and schedule an announcement for a category; cancel pending announcements |

Discord channels/roles are listed live from the bot's connection. Telegram chats/topics are listed from what the bot has seen in messages — send a message (or `/categorias`) in the target chat/topic at least once so it shows up as a subscription target.

**Available template variables:**

| Variable | Value |
|---|---|
| `{{contest_name}}` | Contest name |
| `{{platform}}` | Codeforces / AtCoder |
| `{{start_time}}` | Start date and time (UTC) |
| `{{duration}}` | Duration (e.g. `2h 30m`) |
| `{{contest_url}}` | Link to the contest page |
| `{{tags}}` | Mentions of all users/roles subscribed to be tagged for this category (empty if none) |
| `{{vp_time}}` | Time the announcement fires — useful for Virtual Participation reminders on past-contest announcements |

`cuando` (when scheduling an announcement) accepts a time of day (`18:00`), an ISO 8601 datetime (`2024-06-01T18:00:00Z`), or a relative offset (`30m`, `2h`, `1d`).

**Behaviour by category type:**

| Category type | `cuando` meaning | Default |
|---|---|---|
| `normal` | Time to send the announcement | 30 min before contest start |
| `simulacion` | **Simulation start time** (announcement fires 5 min before) | Required |
