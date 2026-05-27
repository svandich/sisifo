# Entrenador Sisifo

A NestJS bot that schedules and delivers competitive programming contest announcements to Discord channels and Telegram chats.

## How it works

1. **Create a category** — a named topic with a type: **normal** (upcoming contest) or **simulación** (past contest replayed as practice)
2. **Subscribe channels** — link Discord channels or Telegram chats/topics to a category; mark a subscription as **admin** to receive full contest details in simulaciones
3. **Schedule an announcement** — pick a contest and a category; the bot sends the message at the right time to every subscriber

Announcements are dispatched every minute via a cron job.

### Category types

| Type | Default send time | Start time shown | Contest identity |
|---|---|---|---|
| `normal` | 30 min before contest start | Actual contest start | Always shown |
| `simulacion` | 5 min before sim start | Sim start (`cuando`) | Hidden from public subs; shown to admin subs |

## Quick start — upcoming contest (Discord)

```
/categoria agregar nombre:Entrenamiento Semanal tipo:Concurso próximo
/suscripcion agregar categoria:entrenamiento_semanal
/contest upcoming platform:codeforces
/anunciar programar plataforma:codeforces id_concurso:12345 categoria:entrenamiento_semanal
```

## Quick start — simulación (Discord)

```
/categoria agregar nombre:Simulaciones tipo:Simulación
/suscripcion agregar categoria:simulaciones                       # public channel
/suscripcion agregar categoria:simulaciones canal:#admin admin:true  # admin channel
/contest search platform:codeforces query:round
/anunciar programar plataforma:codeforces id_concurso:12345 categoria:simulaciones cuando:2024-06-01T18:00:00Z
```

## Quick start (Telegram)

Add the bot to a group, then as an admin:

```
/categorias
/suscribir entrenamiento_semanal          # public subscription
/suscribir simulaciones admin             # admin subscription (sees full contest details)
```

## Docs

- [Setup](setup.md) — environment variables, running the bot
- [Commands](commands.md) — full command reference for Discord and Telegram
