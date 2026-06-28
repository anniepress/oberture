import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchTmdb, type TmdbResult } from "@/lib/tmdb.functions";
import { AuthChip } from "@/components/AuthChip";
import { TitleDetailModal } from "@/components/TitleDetailModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oberture — Search films & TV" },
      {
        name: "description",
        content: "Search for films and TV shows to track on Oberture.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const search = useServerFn(searchTmdb);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TmdbResult | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    search({ data: { query: debounced } })
      .then((data) => {
        if (id !== reqId.current) return;
        setResults(data);
      })
      .catch(() => {
        if (id !== reqId.current) return;
        setResults([]);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [debounced, search]);

  const hasQuery = debounced.length > 0;
  const showEmpty = hasQuery && !loading && results.length === 0;

  return (
    <main className="min-h-screen px-4 pt-14 pb-24 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <AuthChip />
        </div>
        <header className="flex flex-col items-center text-center">
          <h1 className="wordmark text-6xl sm:text-7xl leading-none">
            Oberture
          </h1>
          <p className="mt-3 text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Films · Television · Catalogued
          </p>
          <div className="chrome-divider mt-8 w-full max-w-xl" />
        </header>

        <div className="mx-auto mt-10 w-full max-w-2xl">
          <SearchInput value={query} onChange={setQuery} />
        </div>

        <section className="mt-14">
          {loading && <LoadingGrid />}
          {!loading && results.length > 0 && (
            <ResultsGrid results={results} onSelect={setSelected} />
          )}
          {showEmpty && <EmptyState query={debounced} />}
          {!hasQuery && !loading && <IdleState />}
        </section>
      </div>
      <TitleDetailModal
        item={selected}
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      />
    </main>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="group relative">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-xl blur-xl opacity-60 transition-opacity group-focus-within:opacity-100"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 50%, color-mix(in oklab, var(--burgundy) 35%, transparent), transparent)",
        }}
      />
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 backdrop-blur transition-colors focus-within:border-[color-mix(in_oklab,var(--burgundy)_70%,var(--border))]">
        <SearchIcon />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search films & TV shows..."
          className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          aria-label="Search films and TV shows"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            clear
          </button>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ResultsGrid({
  results,
  onSelect,
}: {
  results: TmdbResult[];
  onSelect: (item: TmdbResult) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {results.map((r) => (
        <PosterCard
          key={`${r.mediaType}-${r.id}`}
          item={r}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function PosterCard({
  item,
  onSelect,
}: {
  item: TmdbResult;
  onSelect: (item: TmdbResult) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="poster-card group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyber-cyan)]"
      aria-label={`Open ${item.title}`}
    >
      <div className="relative aspect-[2/3] w-full">
        {item.posterUrl ? (
          <img
            src={item.posterUrl}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[oklch(0.12_0.01_30)] p-4 text-center">
            <span className="font-display text-lg italic leading-tight text-muted-foreground">
              {item.title}
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2">
          <MediaBadge type={item.mediaType} />
        </div>
      </div>
      <div className="p-3">
        <h3
          className="line-clamp-2 text-sm font-medium text-foreground"
          title={item.title}
        >
          {item.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.year ?? "—"}
        </p>
      </div>
    </button>
  );
}

function MediaBadge({ type }: { type: "movie" | "tv" }) {
  const isMovie = type === "movie";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur"
      style={{
        background: isMovie
          ? "color-mix(in oklab, var(--burgundy) 80%, transparent)"
          : "color-mix(in oklab, var(--midnight) 80%, transparent)",
        color: "oklch(0.97 0.01 60)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in oklab, white 12%, transparent)",
      }}
    >
      {isMovie ? "Film" : "TV"}
    </span>
  );
}

function LoadingGrid() {
  const skeletons = useMemo(() => Array.from({ length: 10 }), []);
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {skeletons.map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[var(--radius)] border border-border bg-card"
        >
          <div className="aspect-[2/3] w-full animate-pulse bg-[oklch(0.2_0.01_30)]" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-[oklch(0.22_0.01_30)]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-[oklch(0.22_0.01_30)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-3xl italic text-foreground">
        Nothing found
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        No films or shows matched{" "}
        <span className="text-foreground">&ldquo;{query}&rdquo;</span>. Try a
        different title.
      </p>
    </div>
  );
}

function IdleState() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="font-display text-2xl italic text-muted-foreground">
        Search the canon.
      </p>
      <p className="mt-3 text-xs uppercase tracking-[0.3em] text-muted-foreground/70">
        Start typing to find something to watch
      </p>
    </div>
  );
}
