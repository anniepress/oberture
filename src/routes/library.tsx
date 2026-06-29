import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AuthChip } from "@/components/AuthChip";
import { HeaderNav } from "@/components/HeaderNav";
import { supabase } from "@/integrations/supabase/client";
import {
  listLibrary,
  type EntryStatus,
  type LibraryEntry,
} from "@/lib/library.functions";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Oberture — Library" },
      {
        name: "description",
        content:
          "Your personal Oberture library of films and TV shows you've watched, are watching, and want to watch next.",
      },
      { property: "og:title", content: "Oberture — Library" },
      {
        property: "og:description",
        content:
          "Browse the films and TV shows you've logged on Oberture, filtered by watched, watching, and watchlist.",
      },
      { property: "og:url", content: "https://oberture.lovable.app/library" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://oberture.lovable.app/library" }],
  }),
  component: LibraryPage,
});

type Tab = "all" | EntryStatus;

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "watched", label: "Watched" },
  { value: "watching", label: "Watching" },
  { value: "want_to_watch", label: "Want to Watch" },
];

function LibraryPage() {
  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const list = useServerFn(listLibrary);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["library"],
    queryFn: () => list(),
    enabled: authed,
    staleTime: 10_000,
  });

  const entries = data ?? [];
  const filtered = useMemo(
    () => (tab === "all" ? entries : entries.filter((e) => e.status === tab)),
    [entries, tab],
  );

  return (
    <main className="min-h-screen px-4 pt-14 pb-24 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
          <HeaderNav />
          <AuthChip />
        </div>
        <header className="flex flex-col items-center text-center">
          <h1 className="wordmark text-5xl sm:text-6xl leading-none">Library</h1>
          <p className="mt-3 text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Your archive · Catalogued
          </p>
          <div className="chrome-divider mt-8 w-full max-w-xl" />
        </header>

        {authReady && !authed && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="font-mono text-xl text-foreground">Access denied</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Sign in to view your library.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex items-center rounded-sm border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground hover:text-[color:var(--cyber-cyan)]"
              style={{
                borderColor:
                  "color-mix(in oklab, var(--cyber-cyan) 60%, var(--border))",
              }}
            >
              Sign in →
            </Link>
          </div>
        )}

        {authed && (
          <>
            <div className="mx-auto mt-10 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2">
              {TABS.map((t) => {
                const active = tab === t.value;
                const count =
                  t.value === "all"
                    ? entries.length
                    : entries.filter((e) => e.status === t.value).length;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTab(t.value)}
                    className="inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] transition-all"
                    style={{
                      borderColor: active
                        ? "var(--cyber-cyan)"
                        : "color-mix(in oklab, var(--cyber-cyan) 25%, var(--border))",
                      background: active
                        ? "color-mix(in oklab, var(--cyber-cyan) 18%, transparent)"
                        : "transparent",
                      color: active ? "var(--cyber-cyan)" : "var(--foreground)",
                      boxShadow: active
                        ? "0 0 14px -2px color-mix(in oklab, var(--cyber-cyan) 70%, transparent)"
                        : "none",
                    }}
                  >
                    {t.label}
                    <span className="text-muted-foreground">[{count}]</span>
                  </button>
                );
              })}
            </div>

            <section className="mt-12" aria-labelledby="library-grid-heading">
              <h2 id="library-grid-heading" className="sr-only">
                Library entries
              </h2>
              {isLoading && <SkeletonGrid />}
              {error && (
                <p className="mt-6 text-center text-sm text-[color:var(--cyber-magenta)]">
                  {error instanceof Error ? error.message : "Failed to load"}
                </p>
              )}
              {!isLoading && !error && filtered.length === 0 && (
                <EmptyState tab={tab} totalEmpty={entries.length === 0} />
              )}
              {!isLoading && filtered.length > 0 && <LibraryGrid items={filtered} />}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function LibraryGrid({ items }: { items: LibraryEntry[] }) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((e) => (
        <LibraryCard key={e.id} entry={e} />
      ))}
    </div>
  );
}

function LibraryCard({ entry }: { entry: LibraryEntry }) {
  const t = entry.title;
  const isMovie = t.type === "movie";
  return (
    <div className="poster-card group block w-full text-left">
      <div className="relative aspect-[2/3] w-full">
        {t.posterUrl ? (
          <img
            src={t.posterUrl}
            alt={t.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[oklch(0.12_0.02_280)] p-4 text-center">
            <span className="font-mono text-sm text-muted-foreground">
              {t.title}
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <span
            className="inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur"
            style={{
              background: isMovie
                ? "color-mix(in oklab, var(--cyber-magenta) 80%, transparent)"
                : "color-mix(in oklab, var(--cyber-cyan) 80%, transparent)",
              color: "oklch(0.08 0.02 280)",
            }}
          >
            {isMovie ? "Film" : "TV"}
          </span>
          <StatusBadge status={entry.status} />
        </div>
        {entry.rating != null && (
          <div
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-bold backdrop-blur"
            style={{
              background: "color-mix(in oklab, var(--background) 75%, transparent)",
              color: "var(--cyber-lime)",
              boxShadow:
                "inset 0 0 0 1px color-mix(in oklab, var(--cyber-lime) 50%, transparent)",
            }}
          >
            <span aria-hidden>★</span>
            {entry.rating}/10
          </div>
        )}
      </div>
      <div className="p-3">
        <h3
          className="line-clamp-2 text-sm font-medium text-foreground"
          title={t.title}
        >
          {t.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t.year ?? "—"}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: EntryStatus }) {
  const map: Record<EntryStatus, { label: string; color: string }> = {
    watched: { label: "Watched", color: "var(--cyber-lime)" },
    watching: { label: "Watching", color: "var(--cyber-cyan)" },
    want_to_watch: { label: "Want", color: "var(--cyber-magenta)" },
  };
  const v = map[status];
  return (
    <span
      className="inline-flex items-center rounded-sm px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em]"
      style={{
        background: "color-mix(in oklab, var(--background) 70%, transparent)",
        color: v.color,
        boxShadow: `inset 0 0 0 1px ${v.color}`,
      }}
    >
      {v.label}
    </span>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[var(--radius)] border border-border bg-card"
        >
          <div className="aspect-[2/3] w-full animate-pulse bg-[oklch(0.2_0.02_285)]" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-[oklch(0.22_0.02_285)]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-[oklch(0.22_0.02_285)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ tab, totalEmpty }: { tab: Tab; totalEmpty: boolean }) {
  const msg =
    totalEmpty || tab === "all"
      ? "Your library is empty"
      : tab === "watched"
        ? "Nothing watched yet"
        : tab === "watching"
          ? "Nothing in progress"
          : "Nothing on the watchlist";
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-mono text-2xl text-foreground">{msg}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
        Add titles from{" "}
        <Link to="/" className="text-[color:var(--cyber-cyan)] hover:underline">
          search →
        </Link>
      </p>
    </div>
  );
}
