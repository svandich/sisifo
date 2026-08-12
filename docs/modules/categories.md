# categories

**Path:** `src/categories/`

## Purpose

Categories are the top-level grouping announcements are organized by (e.g. "Entrenamiento Semanal"). Every subscription, role/user tag, and announcement points at a category by its numeric id or slug. A category's `type` drives significant behavior differences elsewhere — see [announcements](announcements.md).

## Files

- `categories.service.ts` — `CategoriesService`, all CRUD + the slug-generation logic.
- `entities/category.entity.ts` — `Category` TypeORM entity.
- `categories.module.ts` — registers the entity, provides/exports the service. No commands or controllers live here directly (management happens through [admin](admin.md)).

## Data model

`Category` (table `categories`):

| Column | Type | Notes |
|---|---|---|
| `id` | int, PK | |
| `slug` | string, unique | URL/command-safe identifier, auto-generated from `displayName` |
| `displayName` | string | Human-readable name shown in the admin panel and Discord/Telegram messages |
| `type` | `'normal' \| 'simulacion'` | Default `'simulacion'` at the entity level, but callers should be explicit — see below |

## Category types

This is the single most important thing to understand before touching this module or [announcements](announcements.md):

- **`normal`** — an upcoming real contest. Contest identity (name, URL) is always shown to subscribers.
- **`simulacion`** — a past contest replayed as a practice/simulation. Contest identity is **hidden** from public (non-admin) subscriptions and only revealed to subscriptions marked `adminOnly` (see [subscriptions](subscriptions.md)). Scheduling one requires an explicit start time (`cuando`), and the announcement always fires 5 minutes before that time regardless of when the underlying contest actually started.

## Public API

- `create(slug, displayName, type?)` — low-level create; throws if the slug is taken.
- `createFromName(displayName, type?)` — what the [admin API](admin.md) actually calls. Generates the slug via `CategoriesService.slugify()` (lowercases, strips accents, replaces whitespace with `_`, strips anything else non-`[a-z0-9_]`) and delegates to `create`. Default type here is `'normal'`, not `'simulacion'` — the entity-level default only applies if a caller uses `repo.create()` directly without specifying type, which no code path currently does.
- `findAll()`, `findBySlug(slug)`, `findById(id)`, `delete(slug)`.

`CategoriesService.slugify` is also exposed as a `static` method in case slug generation is ever needed outside the service (it currently isn't).

## Dependencies

None (TypeORM feature module only). Imported by [`subscriptions`](subscriptions.md), [`category-tags`](category-tags.md), [`announcements`](announcements.md), [`telegram`](telegram.md), and [`admin`](admin.md).

## Notes

- There's no cascade/guard when deleting a category that still has subscriptions, tags, or pending announcements pointing at it by `categoryId` — deleting one currently just orphans those rows. If you add a delete-safety check, put it in `CategoriesService.delete`.
