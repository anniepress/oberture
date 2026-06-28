import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EntryStatus } from "@/lib/library.functions";

export type ProfileView = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  accountType: string;
  followerCount: number;
  followingCount: number;
  isSelf: boolean;
  isFollowing: boolean;
  canViewEntries: boolean;
};

export type ProfileEntry = {
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

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { username: string }) =>
    z.object({ username: z.string().min(1).max(120) }).parse(i),
  )
  .handler(async ({ data, context }): Promise<ProfileView | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: u, error } = await supabaseAdmin
      .from("users")
      .select("id, username, display_name, avatar_url, bio, account_type")
      .ilike("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!u) return null;

    const [{ count: followerCount }, { count: followingCount }, follow] =
      await Promise.all([
        supabaseAdmin
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", u.id)
          .eq("status", "active"),
        supabaseAdmin
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", u.id)
          .eq("status", "active"),
        userId === u.id
          ? Promise.resolve({ data: null })
          : supabaseAdmin
              .from("follows")
              .select("id")
              .eq("follower_id", userId)
              .eq("following_id", u.id)
              .eq("status", "active")
              .maybeSingle(),
      ]);

    const isSelf = userId === u.id;
    const isFollowing = !!follow?.data;
    const canViewEntries = isSelf || isFollowing || u.account_type === "curator";

    return {
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      bio: u.bio,
      accountType: u.account_type,
      followerCount: followerCount ?? 0,
      followingCount: followingCount ?? 0,
      isSelf,
      isFollowing,
      canViewEntries,
    };
  });

export const listProfileEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<ProfileEntry[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // Visibility: self always; otherwise if owner is curator OR viewer follows owner.
    if (userId !== data.userId) {
      const { data: owner } = await supabaseAdmin
        .from("users")
        .select("account_type")
        .eq("id", data.userId)
        .maybeSingle();
      if (!owner) return [];
      if (owner.account_type !== "curator") {
        const { data: f } = await supabaseAdmin
          .from("follows")
          .select("id")
          .eq("follower_id", userId)
          .eq("following_id", data.userId)
          .eq("status", "active")
          .maybeSingle();
        if (!f) return [];
      }
    }

    const { data: rows, error } = await supabaseAdmin
      .from("entries")
      .select(
        "id, status, rating, updated_at, titles!inner(id, tmdb_id, type, title, poster_url, backdrop_url, overview, release_date)",
      )
      .eq("user_id", data.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row: any) => {
      const t = row.titles;
      const year = t?.release_date
        ? Number(String(t.release_date).slice(0, 4)) || null
        : null;
      return {
        id: row.id,
        status: row.status,
        rating: row.rating ?? null,
        updatedAt: row.updated_at,
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

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { displayName?: string | null; username?: string; bio?: string | null }) =>
      z
        .object({
          displayName: z.string().max(120).nullable().optional(),
          username: z
            .string()
            .min(2)
            .max(40)
            .regex(/^[a-zA-Z0-9_]+$/, "letters, numbers, _ only")
            .optional(),
          bio: z.string().max(500).nullable().optional(),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      display_name?: string | null;
      username?: string;
      bio?: string | null;
    } = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.username !== undefined) patch.username = data.username;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase.from("users").update(patch).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { targetUserId: string; follow: boolean }) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        follow: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.targetUserId === userId) throw new Error("Cannot follow yourself");

    if (data.follow) {
      const { error } = await supabase
        .from("follows")
        .upsert(
          {
            follower_id: userId,
            following_id: data.targetUserId,
            status: "active",
          },
          { onConflict: "follower_id,following_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", data.targetUserId);
      if (error) throw new Error(error.message);
    }
    return { following: data.follow };
  });

export type UserSearchResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  accountType: string;
};

export const searchUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { q: string }) =>
    z.object({ q: z.string().min(1).max(120) }).parse(i),
  )
  .handler(async ({ data }): Promise<UserSearchResult[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.q.trim();
    if (!q) return [];
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const { data: rows, error } = await supabaseAdmin
      .from("users")
      .select("id, username, display_name, avatar_url, account_type")
      .or(`username.ilike.${like},display_name.ilike.${like}`)
      .limit(20);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      accountType: r.account_type,
    }));
  });

export const getCurrentUsername = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ username: string } | null> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("users")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    if (!data) return null;
    return { username: data.username };
  });
