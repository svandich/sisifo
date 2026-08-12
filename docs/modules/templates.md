# templates

**Path:** `src/templates/`

## Purpose

Per-Discord-guild, named, reusable message templates for `normal`-category announcements. `{{variable}}` placeholders get substituted at send time by [`announcements`](announcements.md).

Templates are **not** used for `simulacion` categories — those always use one of the two hardcoded templates in this module (`DEFAULT_SIMULACION_ADMIN_TEMPLATE` / `DEFAULT_SIMULACION_PUBLIC_TEMPLATE`), which is what enforces the "hide contest identity from public subs" rule; a custom template could otherwise leak `{{contest_name}}` to everyone. See [categories](categories.md) for the type distinction.

## Files

- `templates.service.ts` — `TemplatesService`: CRUD, the `{{var}}` substitution engine (`render`), the guild+name resolution helper (`renderTemplate`), and the four default template constants.
- `entities/template.entity.ts` — `Template` TypeORM entity.
- `templates.module.ts` — registers the entity, provides/exports the service. No commands live here (template management moved to the [admin](admin.md) panel).

## Data model

`Template` (table `templates`, unique on `[guildId, name]`):

| Column | Type | Notes |
|---|---|---|
| `id` | int, PK | |
| `guildId` | string | Discord guild the template belongs to — templates are per-guild, not global |
| `name` | string | Unique within a guild |
| `content` | text | Raw template body with `{{var}}` placeholders |

## Default templates (constants, not DB rows)

| Constant | Used when |
|---|---|
| `DEFAULT_CONTEST_TEMPLATE` | `normal` category, no `templateName` given, contest hasn't started yet |
| `DEFAULT_VIRTUAL_TEMPLATE` | `normal` category, no `templateName` given, contest already started (Virtual Participation reminder — see [announcements](announcements.md) for the VP-detection logic) |
| `DEFAULT_SIMULACION_ADMIN_TEMPLATE` | `simulacion` category, admin-only subscription |
| `DEFAULT_SIMULACION_PUBLIC_TEMPLATE` | `simulacion` category, public subscription |

## Available `{{variables}}`

`{{contest_name}}`, `{{platform}}`, `{{start_time}}`, `{{duration}}`, `{{contest_url}}`, `{{tags}}`, `{{vp_time}}`. These are populated by `announcements.service.ts`'s `buildDiscordVars`/`buildTelegramVars`, not by this module — this module only does the string substitution. An unrecognized `{{var}}` is left as literal text (`render`'s regex replace falls back to `` `{{${key}}}` `` when the key isn't in the variables map), it doesn't throw.

## Public API

- `create(guildId, name, content)` / `update(guildId, name, content)` / `delete(guildId, name)` / `findOne(guildId, name)` / `findAll(guildId)`.
- `render(content, variables): string` — pure substitution, no DB access.
- `renderTemplate(guildId, templateName, variables, fallback?): Promise<string>` — if `templateName` is set, loads that guild's template and renders it (throws `NotFoundException` if missing); otherwise renders `fallback` (defaults to `DEFAULT_CONTEST_TEMPLATE`).

## Dependencies

None (TypeORM feature module only). Imported by [`announcements`](announcements.md) and [`admin`](admin.md).

## Notes

- Because templates are guild-scoped, scheduling a `normal`-category announcement with a custom `templateName` requires knowing *which guild's* template store to read from — that's why `Announcement.guildId` exists (see [announcements](announcements.md)), even though the announcement itself isn't otherwise guild-scoped anymore.
