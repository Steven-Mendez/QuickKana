# Supabase en QuickKana

Backend opcional de respaldo y sincronización multi-dispositivo. Los
invitados funcionan 100% en local (localStorage); iniciar sesión añade sync
por encima sin cambiar la experiencia. **El servidor es la autoridad entre
dispositivos; los stores locales son la fuente de la sesión activa.**

Proyecto remoto: `hxkqgnyopnhxwwbbhpql` (https://hxkqgnyopnhxwwbbhpql.supabase.co)

## Setup desde cero

```bash
# Requisitos: Docker Desktop corriendo, Supabase CLI (brew install supabase/tap/supabase)
pnpm install
supabase start                 # stack local completo
supabase status -o env         # API_URL y PUBLISHABLE_KEY
cp .env.example .env           # y pega los valores locales
pnpm db:reset                  # aplica supabase/migrations/
pnpm gen:types                 # regenera src/types/database.types.ts
pnpm dev                       # http://localhost:3000
```

Para operar contra el proyecto remoto (una vez):

```bash
supabase login
supabase link --project-ref hxkqgnyopnhxwwbbhpql
```

## Flujo de migraciones (declarative schemas + pg-delta)

La fuente de verdad del schema es `supabase/schemas/*.sql` (prefijo numérico
= orden). Nunca se cambia el schema por Studio ni con migraciones a mano.

```bash
# 1. Edita supabase/schemas/*.sql (columnas nuevas al final de la tabla)
pnpm db:diff <nombre>          # = supabase db schema declarative sync --no-apply --name <nombre>
# 2. Revisa la migración generada en supabase/migrations/
pnpm db:reset                  # aplica en local
pnpm db:lint                   # debe quedar en verde
pnpm gen:types                 # regenera tipos y compila
SUPABASE_IT=1 pnpm test        # incluye los E2E contra el stack local
```

Caveats conocidos del diff (verificados en este repo):

- **Column privileges**: pg-delta ordena el `revoke all` de tabla después de
  los grants por columna y los pisa. Usa grants a nivel de tabla + RLS.
- **DML / data migrations**: no las captura; `supabase migration new`.
- Las extensiones de plataforma deben declararse (`00_extensions.sql`) o
  pg-delta trata el árbol como legacy y se niega a sincronizar.
- El trigger sobre `auth.users` y las publicaciones Realtime sí se capturan.

**Deploy del schema al remoto** (siempre con confirmación explícita):

```bash
supabase db push --dry-run     # revisa qué se aplicaría
supabase db push
```

**Deploy de la Edge Function:**

```bash
supabase functions deploy delete-account
```

## Modelo de datos

Todas las tablas en `public`, RLS habilitado, políticas por operación con
`(select auth.uid()) = user_id`, `anon` sin ningún privilegio y sin
`TRUNCATE` para roles de cliente (no pasa por RLS).

| Tabla | Rol |
|---|---|
| `profiles` | 1:1 con `auth.users` (trigger `handle_new_user`); `imported_at` sella el import one-shot |
| `attempts` | Append-only, pk **uuid generado en cliente** (idempotencia por evento); fuente de verdad recomputable. Solo primeros intentos |
| `char_stats` / `writing_char_stats` | Agregados por (user, kana); contadores por deltas, weight/streak LWW, récords con `greatest()` |
| `confusion_pairs` | Simétricos, orden canónico `kana_a < kana_b` (check) |
| `confusion_groups` | Estado calculado por el cliente, LWW por `updated_at` |
| `typos` | Por (kana mostrado, texto tecleado) — nunca entran a la matriz |
| `progression` | Journey: campos monotónicos con `greatest()`/merge jsonb (un reloj atrasado no borra lecciones), preferencias LWW |
| `user_totals` | Contadores de sesiones (solo deltas, separados de progression a propósito) |
| `user_settings` | Blobs `settings`/`selection`, LWW. `theme`/`language` jamás se sincronizan |
| `sync_batches` | Llave de idempotencia por lote |

RPCs (`security invoker`, `set search_path = ''`, EXECUTE solo para
`authenticated`):

- `sync_push(batch_id, events, aggregates)` — transaccional e idempotente:
  el insert del batch con `on conflict do nothing` es la puerta; replays
  devuelven `duplicate`. Deltas para contadores, LWW para valores absolutos.
  **El algoritmo de pesos/rachas/grupos vive solo en el cliente**; SQL
  almacena sus salidas.
- `import_local_snapshot(snapshot)` — solo si `imported_at is null` **y** la
  cuenta está vacía, bajo row lock (dos pestañas no pueden importar ambas).
- `delete_user_data()` — vaciado remoto para "Borrar todo".

## Capa de sync del cliente (`src/lib/sync/`)

- `queue.ts` — outbox persistido en `qk:v1:sync-queue`. **Los invitados no
  encolan**: sus datos entran por el import al crear cuenta. La cola lleva
  `userId`; otra cuenta iniciando sesión la descarta.
- `batch.ts` — deltas acumulados + valores point-in-time leídos de los
  stores al construir el lote.
- `engine.ts` — flush cada 10 s con backoff exponencial (5 s → 5 min),
  reintento del batch inflight con el mismo uuid, `fetch keepalive` en
  `pagehide`/`visibilitychange`, flush forzado antes de cerrar sesión.
  Realtime: suscripción `postgres_changes` filtrada por `user_id`; un evento
  agenda un pull (debounced 2 s) que solo corre con el outbox vacío.
- `pull.ts` — descarga y reemplaza los stores; respaldo previo en
  `qk:v1:pre-sync-backup`; conserva `theme`/`language` locales.
- Flujo al iniciar sesión: `import_local_snapshot` → `pullAll` → loop.

## Configuración del dashboard (producción)

Ver la sección "Dashboard configuration" del README: Site URL + redirect
`https://<origin>/auth/callback`, provider de Google, y plantillas de email
apuntando a `/auth/confirm?token_hash={{ .TokenHash }}&type=…`.

## Verificación

- `SUPABASE_IT=1 pnpm test` — E2E contra el stack local: import una sola
  vez, dos dispositivos sin doble conteo, cola offline aplicada exactamente
  una vez, evento Realtime entregado.
- `scratchpad`/curl: RLS probado a mano (un usuario no ve filas de otro,
  `anon` denegado, replay de batch = `duplicate`).

## Futuro (documentado, no implementado)

- CI (GitHub Actions): `supabase db push` en `main` + verificación de drift
  de `gen types` — requiere `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD`
  como secrets.
- `signInAnonymously()` + `linkIdentity()` si algún día se quiere cuenta
  anónima previa al registro.
- Storage/Vault/pg_cron/Queues: sin caso de uso actual.
