import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["watched", "watching", "want_to_watch"] as const;
export type EntryStatus = (typeof STATUSES)[number];

const tmdbSchema = z.object({
  id: z.number().int(),
  mediaType: z.enum(["movie", "tv"]),
  title: z.string().min(1).max(500),
  overview: z.string().max(5000).optional().default(""),
  posterUrl: z.string().url().nullable().optional(),
  backdropUrl: z.string().url().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
});

export const getEntryForTmdb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tmdbId: number }) =>
    z.object({ tmdbId: z.number().int() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ status: EntryStatus } | null> => {
    const { supabase, userId } = context;

    const { data: title } = await supabase
      .from("titles")
      .select("id")
      .eq("tmdb_id", data.tmdbId)
      .maybeSingle();

    if (!title) return null;

    const { data: entry } = await supabase
      .from("entries")
      .select("status")
      .eq("user_id", userId)
      .eq("title_id", title.id)
      .maybeSingle();

    if (!entry) return null;
    return { status: entry.status as EntryStatus };
  });

export const upsertEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tmdb: unknown; status: string }) =>
    z
      .object({
        tmdb: tmdbSchema,
        status: z.enum(STATUSES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ titleId: string; status: EntryStatus }> => {
    const { supabase, userId } = context;
    const { tmdb, status } = data;

    const nowIso = new Date().toISOString();

    const { data: titleRow, error: titleErr } = await supabase
      .from("titles")
      .upsert(
        {
          tmdb_id: tmdb.id,
          type: tmdb.mediaType,
          title: tmdb.title,
          overview: tmdb.overview ?? "",
          poster_url: tmdb.posterUrl ?? null,
          backdrop_url: tmdb.backdropUrl ?? null,
          release_date: tmdb.releaseDate ?? null,
          cached_at: nowIso,
        },
        { onConflict: "tmdb_id" },
      )
      .select("id")
      .single();

    if (titleErr || !titleRow) {
      throw new Error(titleErr?.message ?? "Failed to save title");
    }

    // Read existing entry so we only set watched_at on first transition to watched.
    const { data: existing } = await supabase
      .from("entries")
      .select("status, watched_at")
      .eq("user_id", userId)
      .eq("title_id", titleRow.id)
      .maybeSingle();

    const shouldStampWatched =
      status === "watched" && (!existing || existing.status !== "watched");

    const { error: entryErr } = await supabase.from("entries").upsert(
      {
        user_id: userId,
        title_id: titleRow.id,
        status,
        updated_at: nowIso,
        ...(shouldStampWatched ? { watched_at: nowIso } : {}),
      },
      { onConflict: "user_id,title_id" },
    );

    if (entryErr) throw new Error(entryErr.message);

    return { titleId: titleRow.id, status };
  });
