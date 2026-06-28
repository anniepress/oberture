## Phase 3A — Add a title to the library

Tap any search result card → open a modal showing the title's detail and three status buttons that write to Supabase. No new tables, no policy changes, no library screen.

### What the user sees

- Click a `PosterCard` in the search grid → modal opens.
- Modal contents:
  - Large poster (or a styled fallback if no poster).
  - Title + year, Film/TV badge (matches existing `MediaBadge`).
  - Overview / synopsis paragraph (TMDB).
  - Three status buttons: **Watched**, **Watching**, **Want to Watch**.
- If signed-out: the three buttons are replaced by a small "Sign in to track" link to `/auth`.
- If the user already has an entry for this title: that status's button is rendered as "active" (filled neon accent), the other two as muted outlines. Tapping a different button switches the status.
- Tapping a status button:
  - Button enters a "saving…" state.
  - On success: brief checkmark / neon-flicker confirmation, then the tapped button stays highlighted as the new active status.
  - On error: inline error line under the buttons, buttons re-enabled.
- Modal stays open. Closing is via the existing dialog X / overlay click / Esc.

### Data flow

1. Extend the TMDB search server fn so each result already carries the fields we need to seed a `titles` row (no extra TMDB round-trip).
2. On modal open, look up whether the current user already has an entry for this `tmdb_id` and prefill the active status.
3. On button tap, a single server fn `upsertEntry({ tmdb, status })`:
   - Upserts the `titles` row by `tmdb_id` (insert if missing, otherwise reuse `id`).
   - Upserts the `entries` row by `(user_id, title_id)` with the chosen status.
   - Returns `{ titleId, status }`.

Existing RLS already allows authenticated users to insert/update `titles` and manage their own `entries`, so no policy changes.

### Technical details

**Server functions** (`src/lib/library.functions.ts`, client-safe path):

- `searchTmdb` (edit existing `src/lib/tmdb.functions.ts`): add `overview`, `backdropUrl`, `releaseDate` (full YYYY-MM-DD or null), `genreIds` to each result. `TmdbResult` type updated; existing search UI consumes the same fields it already does.
- `getEntryForTmdb({ tmdbId })` — `requireSupabaseAuth`. Joins `titles` by `tmdb_id`, then `entries` by `user_id = context.userId`. Returns `{ status } | null`. Uses `.maybeSingle()`.
- `upsertEntry({ tmdb, status })` — `requireSupabaseAuth`.
  - Validates `status ∈ {watched, watching, want_to_watch}` and `tmdb.type ∈ {movie, tv}` with zod.
  - `supabase.from('titles').upsert({ tmdb_id, type, title, overview, poster_url, backdrop_url, release_date, cached_at: now() }, { onConflict: 'tmdb_id' }).select('id').single()`.
  - `supabase.from('entries').upsert({ user_id: context.userId, title_id, status, updated_at: now() }, { onConflict: 'user_id,title_id' }).select('status').single()`.
  - Sets `watched_at = now()` only when status transitions to `watched` and was not previously watched (read existing row first to decide).

**UI**:

- New `src/components/TitleDetailModal.tsx` built on existing `Dialog` primitive, restyled to fit the Y2K cyber palette (neon borders, mono headings, scanline veneer consistent with current `styles.css`). Props: `item: TmdbResult | null`, `open`, `onOpenChange`.
- Inside the modal, use TanStack Query:
  - `useQuery(['entry', tmdb_id], getEntryForTmdb)` — gated on session.
  - `useMutation(upsertEntry)` → on success, set query data + show 1.2s "saved" pulse on the tapped button.
- `src/routes/index.tsx`: wrap each `PosterCard` in a `<button>` that sets `selected` state; render `<TitleDetailModal item={selected} open={!!selected} onOpenChange={…} />` once at the page root. No routing change, no other screens touched.
- Auth state inside the modal reuses the same `supabase.auth.getSession()` pattern as `AuthChip`.

### Out of scope (deferred to 3B)

- Rating, review, mood tags, liked, spoilers, watched_at editing UI.
- Library screen, removing an entry, navigation to a dedicated title page.
- Genre name resolution (column left null for now; can be backfilled in 3B).