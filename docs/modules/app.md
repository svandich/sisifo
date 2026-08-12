# App bootstrap

**Path:** `src/app.module.ts`, `src/main.ts`

## Purpose

Root wiring for the whole application: database connection, global config, and the top-level module graph. There is no "app" directory — these two files live directly in `src/`.

## Files

- `src/app.module.ts` — the root `AppModule`. Registers `ConfigModule` (global, reads `.env`), `ScheduleModule` (powers `@Cron` in [announcements](announcements.md)), the TypeORM connection, and imports [`BotModule`](bot.md) and [`AdminModule`](admin.md).
- `src/main.ts` — process entrypoint. Creates the Nest app as a full HTTP server (not a headless application context), mounts the [admin](admin.md) API under `/api`, serves `public/` (the [frontend](../../public)) as static files, and listens on `PORT`.

## Data model

`TypeOrmModule.forRootAsync` in `app.module.ts` is the single place that lists every TypeORM entity in the app (`entities: [...]`). **Any new entity in any module must be added to this array** or TypeORM will not create its table (schema is `synchronize: true`, i.e. auto-migrated from entity classes — no manual migrations).

Current entities registered here: `Template`, `Announcement`, `Category`, `Subscription`, `CategoryTag`, `TelegramChat`, `TelegramTopic`.

## Behavior notes

- `main.ts` calls `config.getOrThrow<string>('ADMIN_TOKEN')` at boot — the process refuses to start without it, since it's the only thing gating the admin API (see [admin](admin.md)).
- `app.setGlobalPrefix('api')` applies to every Nest controller route (currently only `AdminModule`'s controllers). Static assets served via `useStaticAssets` are express middleware, not Nest routes, so they're unaffected by the prefix — `public/index.html` is served at `/`, not `/api/`.
- `DATABASE_PATH` defaults to `./data/sisifo.sqlite`; the `./data` directory is created on boot if missing.
- `PORT` defaults to `3000`.

## Dependencies

Imports `BotModule` and `AdminModule` directly. Every other module is reached transitively through those two (see each module's own doc for its import chain).
