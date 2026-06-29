import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { getEntryForTmdb, upsertEntry, setRating, type EntryStatus } from "@/lib/library.functions";
import { getWatchSources, type WatchSource } from "@/lib/watchmode.functions";
import type { TmdbResult } from "@/lib/tmdb.functions";


const STATUS_OPTIONS: { value: EntryStatus; label: string }[] = [
  { value: "watched", label: "Watched" },
  { value: "watching", label: "Watching" },
  { value: "want_to_watch", label: "Want to Watch" },
];

export function TitleDetailModal({
  item,
  open,
  onOpenChange,
}: {
  item: TmdbResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl border-0 bg-transparent p-0 shadow-none max-md:top-4 max-md:flex max-md:max-h-[calc(100dvh-2rem)] max-md:translate-y-0 max-md:flex-col max-md:overflow-hidden max-md:[&>button]:fixed max-md:[&>button]:right-4 max-md:[&>button]:top-4 max-md:[&>button]:z-[60] max-md:[&>button]:rounded-sm max-md:[&>button]:border max-md:[&>button]:border-border max-md:[&>button]:bg-card/95 max-md:[&>button]:p-1.5 max-md:[&>button]:opacity-100 max-md:[&>button]:shadow-md max-md:[&>button]:backdrop-blur"
      >
        <div className="max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:overscroll-contain max-md:pt-2">
          {item && <Body item={item} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Body({ item }: { item: TmdbResult }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isMovie = item.mediaType === "movie";

  return (
    <div
      className="relative overflow-hidden rounded-sm border bg-card backdrop-blur"
      style={{
        borderColor: "color-mix(in oklab, var(--cyber-magenta) 55%, var(--border))",
        boxShadow:
          "0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 30%, transparent), 0 0 48px -8px color-mix(in oklab, var(--cyber-magenta) 70%, transparent)",
      }}
    >
      {item.backdropUrl && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 opacity-25"
          style={{
            backgroundImage: `url(${item.backdropUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(1.2) contrast(1.05) hue-rotate(-10deg)",
          }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--background) 70%, transparent), var(--card) 70%)",
        }}
      />
      <div className="relative z-10 grid gap-6 p-5 sm:grid-cols-[200px_1fr] sm:p-6">
        <div className="mx-auto w-40 sm:mx-0 sm:w-full">
          <div
            className="aspect-[2/3] w-full overflow-hidden rounded-sm border"
            style={{
              borderColor: "color-mix(in oklab, var(--cyber-cyan) 45%, var(--border))",
              boxShadow:
                "4px 4px 0 0 color-mix(in oklab, var(--cyber-magenta) 80%, transparent)",
            }}
          >
            {item.posterUrl ? (
              <img
                src={item.posterUrl}
                alt={`${item.title} poster`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[oklch(0.12_0.02_280)] p-4 text-center">
                <span className="font-mono text-sm text-muted-foreground">
                  {item.title}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{
                background: isMovie
                  ? "color-mix(in oklab, var(--cyber-magenta) 25%, transparent)"
                  : "color-mix(in oklab, var(--cyber-cyan) 22%, transparent)",
                color: isMovie ? "var(--cyber-magenta)" : "var(--cyber-cyan)",
                boxShadow: `inset 0 0 0 1px ${
                  isMovie ? "var(--cyber-magenta)" : "var(--cyber-cyan)"
                }`,
              }}
            >
              {isMovie ? "Film" : "TV"}
            </span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              tmdb · {item.id}
            </span>
          </div>

          <DialogTitle
            className="mt-3 font-mono text-2xl leading-tight text-foreground sm:text-3xl"
            style={{
              textShadow:
                "1px 0 0 color-mix(in oklab, var(--cyber-magenta) 60%, transparent), -1px 0 0 color-mix(in oklab, var(--cyber-cyan) 60%, transparent)",
            }}
          >
            {item.title}
            {item.year && (
              <span className="ml-2 text-muted-foreground">[{item.year}]</span>
            )}
          </DialogTitle>

          <DialogDescription className="mt-4 max-h-48 overflow-y-auto pr-2 text-sm leading-relaxed text-foreground/85">
            {item.overview || (
              <span className="italic text-muted-foreground">
                No synopsis available.
              </span>
            )}
          </DialogDescription>

          <div className="chrome-divider mt-6 w-full" />

          <div className="mt-5">
            {!authReady ? (
              <div className="h-10 w-full animate-pulse rounded-sm bg-[oklch(0.2_0.03_285)]" />
            ) : user ? (
              <StatusButtons item={item} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Sign in to add to your library
                </p>
                <Link
                  to="/auth"
                  className="inline-flex items-center rounded-sm border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground transition-colors hover:text-[color:var(--cyber-cyan)]"
                  style={{
                    borderColor:
                      "color-mix(in oklab, var(--cyber-cyan) 60%, var(--border))",
                  }}
                >
                  Sign in →
                </Link>
              </div>
            )}
          </div>

          <WhereToWatch item={item} />
        </div>

      </div>
    </div>
  );
}

function StatusButtons({ item }: { item: TmdbResult }) {
  const qc = useQueryClient();
  const getEntry = useServerFn(getEntryForTmdb);
  const upsert = useServerFn(upsertEntry);

  const queryKey = ["entry", item.id] as const;

  const { data: entry, isLoading } = useQuery({
    queryKey,
    queryFn: () => getEntry({ data: { tmdbId: item.id } }),
    staleTime: 30_000,
  });

  const [justSaved, setJustSaved] = useState<EntryStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (status: EntryStatus) =>
      upsert({
        data: {
          tmdb: {
            id: item.id,
            mediaType: item.mediaType,
            title: item.title,
            overview: item.overview ?? "",
            posterUrl: item.posterUrl,
            backdropUrl: item.backdropUrl,
            releaseDate: item.releaseDate,
          },
          status,
        },
      }),
    onMutate: () => setErrorMsg(null),
    onSuccess: (res) => {
      qc.setQueryData(queryKey, (prev: any) => ({
        status: res.status,
        rating: prev?.rating ?? null,
      }));
      setJustSaved(res.status);
      window.setTimeout(() => {
        setJustSaved((s) => (s === res.status ? null : s));
      }, 1200);
    },
    onError: (e: unknown) => {
      setErrorMsg(e instanceof Error ? e.message : "Failed to save");
    },
  });

  const active = entry?.status ?? null;
  const pendingStatus = mutation.isPending
    ? (mutation.variables as EntryStatus | undefined)
    : null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = active === opt.value;
          const isPending = pendingStatus === opt.value;
          const isSaved = justSaved === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={mutation.isPending || isLoading}
              onClick={() => mutation.mutate(opt.value)}
              className="group relative inline-flex min-w-[110px] items-center justify-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all disabled:cursor-wait"
              style={{
                borderColor: isActive
                  ? "var(--cyber-lime)"
                  : "color-mix(in oklab, var(--cyber-cyan) 35%, var(--border))",
                background: isActive
                  ? "color-mix(in oklab, var(--cyber-lime) 18%, transparent)"
                  : "color-mix(in oklab, var(--card) 70%, transparent)",
                color: isActive ? "var(--cyber-lime)" : "var(--foreground)",
                boxShadow: isActive
                  ? "0 0 16px -2px color-mix(in oklab, var(--cyber-lime) 70%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--cyber-lime) 60%, transparent)"
                  : "none",
              }}
            >
              {isSaved && <span aria-hidden>✓</span>}
              {isPending ? "saving…" : opt.label}
            </button>
          );
        })}
      </div>
      {errorMsg && (
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-[color:var(--cyber-magenta)]">
          {errorMsg}
        </p>
      )}
      {active && !errorMsg && (
        <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          In library · {labelFor(active)}
        </p>
      )}
      {active === "watched" && (
        <RatingRow tmdbId={item.id} initial={entry?.rating ?? null} queryKey={queryKey} />
      )}
    </div>
  );
}

function RatingRow({
  tmdbId,
  initial,
  queryKey,
}: {
  tmdbId: number;
  initial: number | null;
  queryKey: readonly unknown[];
}) {
  const qc = useQueryClient();
  const rate = useServerFn(setRating);
  const [hover, setHover] = useState<number | null>(null);
  const [value, setValue] = useState<number | null>(initial);
  const [pending, setPending] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const display = hover ?? value ?? 0;

  async function pick(n: number) {
    const next = value === n ? null : n; // tap same star to clear
    setErr(null);
    setPending(n);
    const prev = value;
    setValue(next);
    try {
      await rate({ data: { tmdbId, rating: next } });
      qc.setQueryData(queryKey, (p: any) => ({ ...(p ?? {}), rating: next }));
    } catch (e) {
      setValue(prev);
      setErr(e instanceof Error ? e.message : "Failed to save rating");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-5 border-t border-border/40 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          Your rating {value ? `· ${value}/10` : "· optional"}
        </p>
        {value !== null && (
          <button
            type="button"
            onClick={() => pick(value)}
            className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-[color:var(--cyber-magenta)]"
          >
            clear
          </button>
        )}
      </div>
      <div
        className="mt-2 flex gap-1"
        onMouseLeave={() => setHover(null)}
        role="radiogroup"
        aria-label="Rating from 1 to 10"
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const filled = n <= display;
          const isPending = pending === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} out of 10`}
              disabled={pending !== null}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onClick={() => pick(n)}
              className="group/star flex h-7 w-7 items-center justify-center rounded-sm font-mono text-sm transition-all disabled:cursor-wait"
              style={{
                color: filled ? "var(--cyber-lime)" : "color-mix(in oklab, var(--foreground) 35%, transparent)",
                textShadow: filled
                  ? "0 0 8px color-mix(in oklab, var(--cyber-lime) 80%, transparent)"
                  : "none",
                transform: isPending ? "scale(0.9)" : "scale(1)",
              }}
            >
              ★
            </button>
          );
        })}
      </div>
      {err && (
        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--cyber-magenta)]">
          {err}
        </p>
      )}
    </div>
  );
}


function labelFor(s: EntryStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

function WhereToWatch({ item }: { item: TmdbResult }) {
  const fetchSources = useServerFn(getWatchSources);
  const [region, setRegion] = useState<string>("US");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid) return;
      const { data: row } = await supabase
        .from("users")
        .select("region")
        .eq("id", uid)
        .maybeSingle();
      if (active && row?.region) setRegion(row.region);
    });
    return () => {
      active = false;
    };
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["watchmode", item.id, item.mediaType, region],
    queryFn: () =>
      fetchSources({
        data: { tmdbId: item.id, mediaType: item.mediaType, region },
      }),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const sub = (data?.sources ?? []).filter((s) => s.type === "sub");
  const rent = (data?.sources ?? []).filter((s) => s.type === "rent");
  const buy = (data?.sources ?? []).filter((s) => s.type === "buy");

  return (
    <div className="mt-6">
      <div className="chrome-divider w-full" />
      <div className="mt-5 flex items-center justify-between">
        <h3
          className="font-mono text-[11px] uppercase tracking-[0.32em] text-foreground"
          style={{
            textShadow:
              "1px 0 0 color-mix(in oklab, var(--cyber-magenta) 50%, transparent), -1px 0 0 color-mix(in oklab, var(--cyber-cyan) 50%, transparent)",
          }}
        >
          ▌ Where to Watch
        </h3>
        <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          region · {region}
        </span>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-8 w-28 animate-pulse rounded-sm bg-[oklch(0.2_0.03_285)]"
              />
            ))}
          </div>
        ) : isError || data?.status === "error" ? (
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            ⚠ {data?.errorCode === "auth" ? "Availability key rejected" : "Availability unavailable"}
          </p>
        ) : data?.status === "not_found" || (sub.length + rent.length + buy.length === 0) ? (
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            ░ Not currently available in {region}
          </p>
        ) : (
          <div className="space-y-4">
            <SourceGroup label="Streaming" sources={sub} accent="var(--cyber-lime)" />
            <SourceGroup label="Rent" sources={rent} accent="var(--cyber-cyan)" />
            <SourceGroup label="Buy" sources={buy} accent="var(--cyber-magenta)" />
          </div>
        )}
      </div>
    </div>
  );
}

function SourceGroup({
  label,
  sources,
  accent,
}: {
  label: string;
  sources: WatchSource[];
  accent: string;
}) {
  if (sources.length === 0) return null;
  // Dedupe by name for chip display (HD/SD variants of same provider).
  const seen = new Set<string>();
  const unique = sources.filter((s) => {
    const k = s.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <div>
      <p
        className="mb-2 text-[10px] font-semibold uppercase tracking-[0.32em]"
        style={{ color: accent }}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {unique.map((s) => {
          const inner = (
            <>
              <span className="truncate">{s.name}</span>
              <span aria-hidden className="text-[10px] opacity-70">↗</span>
            </>
          );
          const className =
            "inline-flex max-w-[180px] items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition-all";
          const style = {
            borderColor: `color-mix(in oklab, ${accent} 45%, var(--border))`,
            background: `color-mix(in oklab, ${accent} 10%, transparent)`,
            color: "var(--foreground)",
            boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 25%, transparent)`,
          } as const;
          return s.webUrl ? (
            <a
              key={`${s.id}-${s.format ?? ""}`}
              href={s.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={className + " hover:-translate-y-0.5"}
              style={style}
            >
              {inner}
            </a>
          ) : (
            <span
              key={`${s.id}-${s.format ?? ""}`}
              className={className + " opacity-70"}
              style={style}
            >
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
}

