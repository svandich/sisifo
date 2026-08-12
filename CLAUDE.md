# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repository.

## Module documentation

`docs/modules/` has one Markdown file per directory under `src/` (plus `app.md` for the root `app.module.ts`/`main.ts` wiring), mirroring the module structure 1:1:

```
src/admin/          → docs/modules/admin.md
src/announcements/  → docs/modules/announcements.md
src/bot/            → docs/modules/bot.md
src/categories/     → docs/modules/categories.md
src/category-tags/  → docs/modules/category-tags.md
src/common/         → docs/modules/common.md
src/contests/       → docs/modules/contests.md
src/discord-client/ → docs/modules/discord-client.md
src/schedules/      → docs/modules/schedules.md
src/subscriptions/  → docs/modules/subscriptions.md
src/telegram/       → docs/modules/telegram.md
src/templates/      → docs/modules/templates.md
app.module.ts, main.ts → docs/modules/app.md
```

Start at `docs/modules/README.md` for the index.

Each doc covers: the module's purpose, its data model (entities/columns), its public API (service methods, or HTTP endpoints for `admin`), which other modules it depends on, and — most importantly — the non-obvious business rules and gotchas that aren't visible just by reading the code (e.g. why a field exists, what breaks if you reorder something, which behavior is intentional vs. incidental).

### Before working on a module

Read that module's doc first. It captures context — prior decisions, constraints, cross-module coupling — that isn't always evident from the code alone, and will save you from re-deriving it or accidentally reintroducing something that was deliberately removed.

### After changing a module

Update its doc in the same change. This includes:

- Adding, removing, or renaming a file, entity, column, service method, or HTTP endpoint.
- Changing a business rule (timing/validation logic, what triggers what, gating behavior).
- Changing which modules import which — the "Dependencies" section in each doc.
- Adding a new module: create its `docs/modules/<name>.md` and add it to `docs/modules/README.md`'s index and the table above.
- Deleting a module: delete its doc and its entry in the index and the table above.

If a change doesn't affect what the doc describes, no doc update is needed — don't pad these files. But if you're unsure whether something is worth documenting, err toward writing the one-sentence "why," not the "what" (the code already says what it does).

### Relationship to `docs/`'s other files

`docs/README.md`, `docs/setup.md`, and `docs/commands.md` are end-user-facing (running the bot, using the admin panel, bot command reference). `docs/modules/` is developer/architecture-facing. Both can need updating for the same change — e.g. adding a new admin endpoint touches `docs/modules/admin.md`; adding a new Discord command touches `docs/modules/bot.md` **and** `docs/commands.md`.
