# QuickKana

Web app para aprender hiragana/katakana. React 19 + TanStack Start (SSR),
Tailwind 4, i18next (ES/EN). Offline-first: los stores de TanStack se espejan a
localStorage (`src/lib/storage.ts`); Supabase es una capa aditiva de sync para
usuarios con sesión — el modo invitado nunca depende de la red.

## Convenciones Supabase de este repo

- **Schema declarativo como fuente de verdad**: todo el schema vive en
  `supabase/schemas/*.sql` (prefijo numérico = orden de aplicación; columnas
  nuevas siempre al final de la tabla). Nunca cambies el schema por Studio,
  SQL editor ni migraciones escritas a mano.
- **Migraciones generadas**: `pnpm db:diff <nombre>` (wrapper de
  `supabase db schema declarative sync`, el flujo pg-delta actual — el viejo
  `db diff -f` ya no usa `schema_paths`) genera la migración en
  `supabase/migrations/`. Revísala a mano: los column privileges no se
  capturan bien (pg-delta ordena `revoke all` de tabla después de los grants
  por columna y los pisa — usa grants a nivel de tabla + RLS). Aplica en
  local con `pnpm db:reset`.
  Las data migrations (DML) que el diff no captura: `supabase migration new`.
- **Tipos generados**: `pnpm gen:types` regenera
  `src/types/database.types.ts` tras cada migración. No lo edites a mano.
- **Nunca `supabase db push` al remoto sin confirmación explícita del usuario.**
- **RLS en todas las tablas**, políticas por operación, `to authenticated`,
  patrón `(select auth.uid()) = user_id`. Funciones `security invoker` +
  `set search_path = ''` salvo justificación documentada.
- **Claves**: en cliente solo la publishable key (`VITE_SUPABASE_PUBLISHABLE_KEY`).
  Jamás una `sb_secret_…` en repo o bundle. `.env` está gitignoreado;
  `.env.example` lleva placeholders.
- `pnpm db:lint`, `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde antes
  de cerrar cualquier fase de trabajo.
- Textos de UI nuevos siempre en ES y EN (`src/lib/i18n/locales/`).
- No se sincronizan a Supabase: `qk:theme`, `qk:language`, `qk:v1:tour-seen`,
  `qk:v1:welcome-seen` (por dispositivo). Los retries tras un fallo no generan
  eventos ni puntúan.
