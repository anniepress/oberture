import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuthChip } from "@/components/AuthChip";
import { HeaderNav } from "@/components/HeaderNav";
import { TitleDetailModal } from "@/components/TitleDetailModal";
import { getFeed, type FeedItem } from "@/lib/activity.functions";
import { searchUsers, type UserSearchResult } from "@/lib/profile.functions";
import type { TmdbResult } from "@/lib/tmdb.functions";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Oberture — Feed" }] }),
  component: FeedPage,
});

function FeedPage() {
  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [selected, setSelected] = useState<TmdbResult | null>(null);
  const fetchFeed = useServerFn(getFeed);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setAuthed(!!s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["feed"],
    queryFn: () => fetchFeed(),
    enabled: authed,
    staleTime: 10_000,
  });

  return (
    <main className="min-h-screen px-4 pt-14 pb-24 sm:pt-20">
      <div className="mx-auto max-w-3xl">
        <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
          <HeaderNav />
          <AuthChip />
        </div>
        <header className="flex flex-col items-center text-center">
          <h1 className="wordmark text-5xl sm:text-6xl leading-none">Feed</h1>
          <p className="mt-3 text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Network · Activity stream
          </p>
          <div className="chrome-divider mt-8 w-full max-w-xl" />
        </header>

        {authReady && !authed && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="font-mono text-xl">Access denied</p>
            <Link
              to="/auth"
              className="mt-6 inline-flex items-center rounded-sm border border-border px-4 py-2 text-[11px] uppercase tracking-[0.25em] hover:text-[color:var(--cyber-cyan)]"
            >
              Sign in →
            </Link>
          </div>
        )}

        {authed && (
          <>
            <div className="mt-8">
              <UserSearch />
            </div>

            <section className="mt-10 space-y-4">
              {isLoading && (
                <p className="text-center text-sm text-muted-foreground">
                  Loading…
                </p>
              )}
              {error && (
                <p className="text-center text-sm text-[color:var(--cyber-magenta)]">
                  {error instanceof Error ? error.message : "Failed to load"}
                </p>
              )}
              {!isLoading && !error && (data ?? []).length === 0 && (
                <div className="mx-auto max-w-md py-12 text-center">
                  <p className="font-mono text-xl">No activity yet</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                    Follow people to see their activity here
                  </p>
                </div>
              )}
              {!isLoading && (data ?? []).length > 0 && (
                <div className="space-y-3">
                  {(data ?? []).map((item) => (
                    <FeedRow
                      key={item.id}
                      item={item}
                      onSelect={setSelected}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
      <TitleDetailModal
        item={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </main>
  );
}

function FeedRow({
  item,
  onSelect,
}: {
  item: FeedItem;
  onSelect: (t: TmdbResult) => void;
}) {
  const verb =
    item.activityType === "logged"
      ? "watched"
      : item.activityType === "added_to_watchlist"
        ? "added to watchlist"
        : `rated ${item.metadata?.rating ?? "?"}/10`;

  const t = item.title;
  return (
    <div
      className="flex gap-4 rounded-sm border border-border bg-card/70 p-3 backdrop-blur"
      style={{
        boxShadow:
          "inset 0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 8%, transparent)",
      }}
    >
      <Link
        to="/profile/$username"
        params={{ username: item.actor.username }}
        className="shrink-0"
      >
        <ActorAvatar
          url={item.actor.avatarUrl}
          name={item.actor.displayName || item.actor.username}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <Link
            to="/profile/$username"
            params={{ username: item.actor.username }}
            className="text-[color:var(--cyber-cyan)] hover:underline"
          >
            @{item.actor.username}
          </Link>{" "}
          · {verb}
        </p>
        {t && (
          <button
            type="button"
            onClick={() =>
              onSelect({
                id: t.tmdbId,
                title: t.title,
                year: t.year ? String(t.year) : null,
                posterUrl: t.posterUrl,
                backdropUrl: t.backdropUrl,
                releaseDate: t.releaseDate,
                overview: t.overview ?? "",
                genreIds: [],
                mediaType: t.type,
              })
            }
            className="mt-2 flex w-full items-center gap-3 rounded-sm border border-border/60 bg-background/40 p-2 text-left transition-colors hover:border-[color-mix(in_oklab,var(--cyber-cyan)_50%,var(--border))]"
          >
            {t.posterUrl ? (
              <img
                src={t.posterUrl}
                alt={t.title}
                loading="lazy"
                className="h-16 w-12 shrink-0 rounded-sm object-cover"
              />
            ) : (
              <div className="h-16 w-12 shrink-0 rounded-sm bg-[oklch(0.15_0.02_280)]" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className="truncate font-mono text-sm text-foreground"
                title={t.title}
              >
                {t.title}
              </p>
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                {t.type === "movie" ? "Film" : "TV"}{" "}
                {t.year ? `· ${t.year}` : ""}
              </p>
            </div>
          </button>
        )}
        <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          {timeAgo(item.createdAt)}
        </p>
      </div>
    </div>
  );
}

function ActorAvatar({ url, name }: { url: string | null; name: string }) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  return url ? (
    <img src={url} alt={name} className="h-10 w-10 rounded-sm object-cover" />
  ) : (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-sm font-mono text-sm font-bold"
      style={{
        background:
          "color-mix(in oklab, var(--cyber-magenta) 25%, transparent)",
        color: "var(--cyber-cyan)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 50%, transparent)",
      }}
    >
      {initial}
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function UserSearch() {
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const find = useServerFn(searchUsers);
  const reqId = useRef(0);
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDeb(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!deb) {
      setResults([]);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    find({ data: { q: deb } })
      .then((r) => {
        if (id === reqId.current) setResults(r);
      })
      .catch(() => {
        if (id === reqId.current) setResults([]);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [deb, find]);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-sm border border-border bg-card/70 px-3 py-2 backdrop-blur focus-within:border-[color-mix(in_oklab,var(--cyber-cyan)_60%,var(--border))]">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: "var(--cyber-cyan)",
            boxShadow: "0 0 8px var(--cyber-cyan)",
          }}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find people by username or name…"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          aria-label="Search users"
        />
        {loading && (
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            …
          </span>
        )}
      </div>
      {results.length > 0 && (
        <div className="mt-2 space-y-1 rounded-sm border border-border bg-card/95 p-2 backdrop-blur">
          {results.map((u) => (
            <Link
              key={u.id}
              to="/profile/$username"
              params={{ username: u.username }}
              className="flex items-center gap-3 rounded-sm px-2 py-1.5 hover:bg-[color-mix(in_oklab,var(--cyber-cyan)_10%,transparent)]"
            >
              <ActorAvatar
                url={u.avatarUrl}
                name={u.displayName || u.username}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {u.displayName || u.username}
                </p>
                <p className="truncate text-[10px] uppercase tracking-[0.22em] text-[color:var(--cyber-cyan)]">
                  @{u.username}
                </p>
              </div>
              {u.accountType === "curator" && (
                <span
                  className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em]"
                  style={{
                    background:
                      "color-mix(in oklab, var(--cyber-magenta) 22%, transparent)",
                    color: "var(--cyber-magenta)",
                    boxShadow: "inset 0 0 0 1px var(--cyber-magenta)",
                  }}
                >
                  Curator
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
