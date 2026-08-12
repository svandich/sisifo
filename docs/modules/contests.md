# contests

**Path:** `src/contests/`

## Purpose

Read-only integration with external contest-listing APIs (Codeforces, AtCoder). Used both by the Discord `/contest` browse command and by the [admin](admin.md) panel's contest search/schedule flow. Nothing in this module touches the database — it's a pure external-API adapter layer.

## Files

- `contests.service.ts` — `ContestsService`, a thin router that picks the right provider by platform name.
- `providers/contest-provider.interface.ts` — `IContestProvider`, `Contest`, `ContestFilter`, `ContestPhase` — the shared contract every provider implements.
- `providers/codeforces.provider.ts` — `CodeforcesProvider`, calls `codeforces.com/api/contest.list`.
- `providers/atcoder.provider.ts` — `AtCoderProvider`, calls `kenkoooo.com/atcoder/resources/contests.json` (there's no official AtCoder contest-listing API; this is a well-known community mirror).
- `contest.command.ts` — `ContestCommand`, the Discord `/contest` slash command (`upcoming`/`search`/`info` subcommands). Registered by [`bot`](bot.md).
- `contests.module.ts` — provides/exports `ContestsService` and `ContestCommand`.

## Data model

No entities — nothing here is persisted. `Contest` (the shared shape returned by every provider):

| Field | Notes |
|---|---|
| `externalId` | Provider-specific id (Codeforces numeric id as a string; AtCoder's slug, e.g. `"abc300"`) |
| `platform` | `'codeforces' \| 'atcoder'` |
| `name`, `url`, `startTime`, `durationSeconds` | |
| `phase` | `'UPCOMING' \| 'ONGOING' \| 'FINISHED'` — computed per-provider (Codeforces returns phase directly from its API; AtCoder's phase is derived by comparing `Date.now()` to the contest's start/end) |

## Public API

- `fetchContests(platform, filter?)` — `filter.phase` and/or `filter.query` (case-insensitive substring match on name); both providers filter client-side after fetching their full list — there's no server-side search on either upstream API.
- `getContestById(platform, externalId)` — also fetches the full list and finds by id; **there is no per-contest lookup endpoint on either upstream API**, so this is O(n) over all contests every time. Fine at current scale, worth knowing if either platform's contest list grows large or rate-limits become an issue.
- `getProvider(platform)` / `getPlatformNames()`.

## Dependencies

None. Imported by [`bot`](bot.md) (for `ContestCommand`), [`announcements`](announcements.md) (contest lookup when scheduling), [`admin`](admin.md) (browse UI), and [`schedules`](schedules.md) (contest lookup when adding to a recurring schedule's pool).

## Notes

- Adding a new platform means: implement `IContestProvider`, register it in `ContestsService`'s constructor/`providers` map, and add it to the `platform` choices in `contest.command.ts` and wherever the admin frontend hardcodes the platform dropdown (`public/index.html`'s `#contest-platform` / `#schedule-category`... check `public/app.js` and `public/index.html` for `codeforces`/`atcoder` literals).
