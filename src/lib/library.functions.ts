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

export type EntryView = { status: EntryStatus; rating: number | null };

export const getEntryForTmdb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tmdbId: number }) =>
    z.object({ tmdbId: z.number().int() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<EntryView | null> => {
    const { supabase, userId } = context;

    const { data: title } = await supabase
      .from("titles")
      .select("id")
      .eq("tmdb_id", data.tmdbId)
      .maybeSingle();

    if (!title) return null;

    const { data: entry } = await supabase
      .from("entries")
      .select("status, rating")
      .eq("user_id", userId)
      .eq("title_id", title.id)
      .maybeSingle();

    if (!entry) return null;
    return {
      status: entry.status as EntryStatus,
      rating: (entry.rating as number | null) ?? null,
    };
  });

export type LibraryEntry = {
  id: string;
  status: EntryStatus;
  rating: number | null;
  updatedAt: string | null;
  title: {
    id: string;
    tmdbId: number;
    type: "movie" | "tv";
    title: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    overview: string | null;
    releaseDate: string | null;
    year: number | null;
  };
};

export const listLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LibraryEntry[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("entries")
      .select(
        "id, status, rating, updated_at, titles!inner(id, tmdb_id, type, title, poster_url, backdrop_url, overview, release_date)",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => {
      const t = row.titles;
      const year = t?.release_date
        ? Number(String(t.release_date).slice(0, 4)) || null
        : null;
      return {
        id: row.id as string,
        status: row.status as EntryStatus,
        rating: (row.rating as number | null) ?? null,
        updatedAt: row.updated_at as string | null,
        title: {
          id: t.id,
          tmdbId: t.tmdb_id,
          type: t.type,
          title: t.title,
          posterUrl: t.poster_url,
          backdropUrl: t.backdrop_url,
          overview: t.overview,
          releaseDate: t.release_date,
          year,
        },
      };
    });
  });

async function logActivity(
  supabase: any,
  args: {
    actorId: string;
    activityType: "logged" | "rated" | "added_to_watchlist";
    titleId: string;
    entryId?: string | null;
    metadata?: { rating?: number } | null;
  },
) {
  // Dedupe: if same actor + title + type exists within last 24h, bump created_at instead of inserting.
  const nowIso = new Date().toISOString();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("activity_feed")
    .select("id")
    .eq("actor_id", args.actorId)
    .eq("activity_type", args.activityType)
    .eq("title_id", args.titleId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase
      .from("activity_feed")
      .update({
        created_at: nowIso,
        entry_id: args.entryId ?? null,
        metadata: (args.metadata ?? null) as any,
      })
      .eq("id", existing[0].id);
    return;
  }

  await supabase.from("activity_feed").insert({
    actor_id: args.actorId,
    activity_type: args.activityType,
    title_id: args.titleId,
    entry_id: args.entryId ?? null,
    metadata: (args.metadata ?? null) as any,
  });
}

export const setRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tmdbId: number; rating: number | null }) =>
    z
      .object({
        tmdbId: z.number().int(),
        rating: z.number().int().min(1).max(10).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ rating: number | null }> => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();

    const { data: title, error: tErr } = await supabase
      .from("titles")
      .select("id")
      .eq("tmdb_id", data.tmdbId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!title) throw new Error("Add to library before rating");

    const { data: existing, error: existingErr } = await supabase
      .from("entries")
      .select("id, status")
      .eq("user_id", userId)
      .eq("title_id", title.id)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (!existing) throw new Error("Add to library before rating");

    const { data: entryRow, error } = await supabase
      .from("entries")
      .upsert(
        {
          user_id: userId,
          title_id: title.id,
          status: existing.status,
          rating: data.rating,
          updated_at: nowIso,
        },
        { onConflict: "user_id,title_id" },
      )
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    if (data.rating != null) {
      await logActivity(supabase, {
        actorId: userId,
        activityType: "rated",
        titleId: title.id,
        entryId: entryRow.id,
        metadata: { rating: data.rating },
      });
    }
    return { rating: data.rating };
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

    const { data: existing, error: existingErr } = await supabase
      .from("entries")
      .select("id, status, watched_at")
      .eq("user_id", userId)
      .eq("title_id", titleRow.id)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);

    const shouldStampWatched =
      status === "watched" && (!existing || existing.status !== "watched");

    const { data: entryRow, error: entryErr } = await supabase
      .from("entries")
      .upsert(
        {
          user_id: userId,
          title_id: titleRow.id,
          status,
          updated_at: nowIso,
          ...(shouldStampWatched ? { watched_at: nowIso } : {}),
        },
        { onConflict: "user_id,title_id" },
      )
      .select("id")
      .single();

    if (entryErr) throw new Error(entryErr.message);
    const entryId = entryRow.id;

    const statusChanged = !existing || existing.status !== status;
    if (statusChanged) {
      if (status === "watched") {
        await logActivity(supabase, {
          actorId: userId,
          activityType: "logged",
          titleId: titleRow.id,
          entryId,
        });
      } else if (status === "want_to_watch") {
        await logActivity(supabase, {
          actorId: userId,
          activityType: "added_to_watchlist",
          titleId: titleRow.id,
          entryId,
        });
      }
    }

    return { titleId: titleRow.id, status };
  });
