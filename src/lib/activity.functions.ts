import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeedItem = {
  id: string;
  activityType: "logged" | "rated" | "added_to_watchlist";
  createdAt: string;
  metadata: { rating?: number } | null;
  actor: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
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
  } | null;
};

export const getFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedItem[]> => {
    const { supabase, userId } = context;

    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .eq("status", "active");
    const ids = (follows ?? []).map((r: any) => r.following_id);
    if (ids.length === 0) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("activity_feed")
      .select(
        "id, activity_type, created_at, metadata, actor_id, users:users!activity_feed_actor_id_fkey(id, username, display_name, avatar_url), titles:titles(id, tmdb_id, type, title, poster_url, backdrop_url, overview, release_date)",
      )
      .in("actor_id", ids)
      .in("activity_type", ["logged", "rated", "added_to_watchlist"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any): FeedItem => {
      const t = row.titles;
      const year =
        t?.release_date
          ? Number(String(t.release_date).slice(0, 4)) || null
          : null;
      return {
        id: row.id,
        activityType: row.activity_type,
        createdAt: row.created_at,
        metadata: row.metadata ?? null,
        actor: {
          id: row.users?.id,
          username: row.users?.username,
          displayName: row.users?.display_name ?? null,
          avatarUrl: row.users?.avatar_url ?? null,
        },
        title: t
          ? {
              id: t.id,
              tmdbId: t.tmdb_id,
              type: t.type,
              title: t.title,
              posterUrl: t.poster_url,
              backdropUrl: t.backdrop_url,
              overview: t.overview,
              releaseDate: t.release_date,
              year,
            }
          : null,
      };
    });
  });
