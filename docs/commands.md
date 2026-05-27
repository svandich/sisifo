# Command Reference

Commands marked with a lock require the **Manage Server** permission (Discord) or **admin** status (Telegram).

---

## Discord slash commands

### `/categoria` — manage categories

| Subcommand | Options | Description |
|---|---|---|
| `agregar` | `nombre`, `tipo?` | Create a new category; slug is auto-generated |
| `lista` | — | List all categories with their slugs |

`tipo` choices: **Concurso próximo** (`normal`, default) or **Simulación** (`simulacion`).

### `/suscripcion` — manage subscriptions

| Subcommand | Options | Description |
|---|---|---|
| `agregar` | `categoria`, `canal?`, `admin?` | Subscribe a channel to a category |
| `eliminar` | `categoria`, `canal?`, `admin?` | Unsubscribe a channel |
| `lista` | — | Show all active subscriptions in this server |

`canal` defaults to the current channel when omitted. `admin: true` marks the subscription as an admin subscription — for simulación categories these channels receive the full contest name, platform, and URL; public subscriptions only see the timing and duration.

### `/anunciar` — schedule announcements

| Subcommand | Options | Description |
|---|---|---|
| `programar` | `plataforma`, `id_concurso`, `categoria`, `cuando?`, `plantilla?` | Schedule an announcement |
| `lista` | — | List pending announcements for this server |
| `cancelar` | `id` | Cancel a pending announcement by ID |

`cuando` accepts an ISO 8601 datetime (`2024-06-01T18:00:00Z`) or a relative offset (`30m`, `2h`, `1d`).

**Behaviour by category type:**

| Category type | `cuando` meaning | Default |
|---|---|---|
| `normal` | Time to send the announcement | 30 min before contest start |
| `simulacion` | **Simulation start time** (announcement fires 5 min before) | Required |

For simulaciones, `cuando` must be specified and represents when the simulation begins. The announcement is automatically sent 5 minutes before that time.

### `/suscribirme` — subscribe yourself to be tagged

Any user can run this to opt-in to being mentioned when announcements for a category fire in this server.

| Subcommand | Options | Description |
|---|---|---|
| `agregar` | `categoria` | Start being mentioned in announcements for this category |
| `eliminar` | `categoria` | Stop being mentioned |

The template must include `{{tags}}` for the mention to appear.

### `/tags` — manage role tags (admin only)

Admins can make a Discord role taggable for a category. Requires **Manage Server** permission.

| Subcommand | Options | Description |
|---|---|---|
| `agregar` | `rol`, `categoria` | Add a role to be mentioned in announcements |
| `eliminar` | `rol`, `categoria` | Remove a role from mentions |
| `lista` | `categoria?` | Show all tagged roles and users in this server |

### `/contest` — browse contests

| Subcommand | Options | Description |
|---|---|---|
| `upcoming` | `platform` | List upcoming contests (up to 5) |
| `search` | `platform`, `query` | Search contests by name |
| `info` | `platform`, `id` | Show details for a specific contest |

Supported platforms: `codeforces`, `atcoder`.

### `/template` — message templates

| Subcommand | Options | Description |
|---|---|---|
| `create` | `name`, `content` | Create a new template |
| `edit` | `name`, `content` | Update an existing template |
| `list` | — | List all templates for this server |
| `view` | `name` | Show template content |
| `delete` | `name` | Delete a template |
| `variables` | — | Show available template variables |

**Available variables:**

| Variable | Value |
|---|---|
| `{{contest_name}}` | Contest name |
| `{{platform}}` | Codeforces / AtCoder |
| `{{start_time}}` | Start date and time (UTC) |
| `{{duration}}` | Duration (e.g. `2h 30m`) |
| `{{contest_url}}` | Link to the contest page |
| `{{tags}}` | Mentions of all users/roles subscribed to be tagged for this category (empty if none) |

---

## Telegram commands

Send these in any group where the bot is an admin. If sent inside a **forum topic**, the subscription is scoped to that thread.

| Command | Description |
|---|---|
| `/categorias` | List all categories and their slugs |
| `/suscribir <slug> [admin]` | Subscribe this chat/topic to a category (admin only) |
| `/desuscribir <slug> [admin]` | Unsubscribe this chat/topic from a category (admin only) |
| `/suscribirme <slug>` | Opt-in to be mentioned when announcements for a category fire in this chat |
| `/desuscribirme <slug>` | Opt-out of being mentioned |

Add `admin` after the slug to create/remove an admin subscription that receives full contest details in simulaciones.

The template must include `{{tags}}` for individual Telegram mentions to appear. Mentions use each user's display name as recorded at subscribe time.
