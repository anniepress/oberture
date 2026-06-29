import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuthChip } from "@/components/AuthChip";
import { HeaderNav } from "@/components/HeaderNav";
import { TitleDetailModal } from "@/components/TitleDetailModal";
import {
  getProfile,
  listProfileEntries,
  updateProfile,
  toggleFollow,
  type ProfileEntry,
} from "@/lib/profile.functions";
import type { EntryStatus } from "@/lib/library.functions";
import type { TmdbResult } from "@/lib/tmdb.functions";

export const Route = createFileRoute("/profile/$username")({
  head: ({ params }) => {
    const url = `https://oberture.lovable.app/profile/${params.username}`;
    const title = `@${params.username} — Oberture`;
    const description = `See @${params.username}'s film and TV history on Oberture — watched titles, ratings, watchlist, and recent activity.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "profile" },
        { property: "profile:username", content: params.username },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            url,
            mainEntity: {
              "@type": "Person",
              name: params.username,
              alternateName: `@${params.username}`,
              url,
            },
          }),
        },
      ],
    };
  },
  component: ProfilePage,
});

type Tab = EntryStatus;
const TABS: { value: Tab; label: string }[] = [
  { value: "watched", label: "Watched" },
  { value: "watching", label: "Watching" },
  { value: "want_to_watch", label: "Want to Watch" },
];

function ProfilePage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const fetchEntries = useServerFn(listProfileEntries);
  const follow = useServerFn(toggleFollow);

  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("watched");
  const [selected, setSelected] = useState<TmdbResult | null>(null);
  const [editing, setEditing] = useState(false);

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

  const profileKey = ["profile", username] as const;
  const { data: profile, isLoading: pLoading, error: pError } = useQuery({
    queryKey: profileKey,
    queryFn: () => fetchProfile({ data: { username } }),
    enabled: authed,
  });

  const { data: entries, isLoading: eLoading } = useQuery({
    queryKey: ["profile-entries", profile?.id],
    queryFn: () => fetchEntries({ data: { userId: profile!.id } }),
    enabled: !!profile && profile.canViewEntries,
  });

  const followMutation = useMutation({
    mutationFn: (next: boolean) =>
      follow({ data: { targetUserId: profile!.id, follow: next } }),
    onSuccess: (_d, next) => {
      qc.setQueryData(profileKey, (p: any) =>
        p
          ? {
              ...p,
              isFollowing: next,
              followerCount: Math.max(0, p.followerCount + (next ? 1 : -1)),
            }
          : p,
      );
    },
  });

  const filteredEntries = useMemo(
    () => (entries ?? []).filter((e) => e.status === tab),
    [entries, tab],
  );

  return (
    <main className="min-h-screen px-4 pt-14 pb-24 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
          <HeaderNav />
          <AuthChip />
        </div>

        {authReady && !authed && (
          <div className="mx-auto mt-24 max-w-md text-center">
            <p className="font-mono text-xl">Sign in to view profiles</p>
            <Link
              to="/auth"
              className="mt-6 inline-flex items-center rounded-sm border border-border px-4 py-2 text-[11px] uppercase tracking-[0.25em] hover:text-[color:var(--cyber-cyan)]"
            >
              Sign in →
            </Link>
          </div>
        )}

        {authed && pLoading && (
          <div className="mx-auto mt-24 max-w-md text-center text-muted-foreground">
            Loading…
          </div>
        )}
        {authed && pError && (
          <div className="mx-auto mt-24 max-w-md text-center text-[color:var(--cyber-magenta)]">
            {pError instanceof Error ? pError.message : "Failed to load"}
          </div>
        )}
        {authed && !pLoading && !pError && !profile && (
          <div className="mx-auto mt-24 max-w-md text-center">
            <p className="font-mono text-xl">No user @{username}</p>
          </div>
        )}

        {authed && profile && (
          <>
            <header className="mt-6 flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:gap-8 sm:text-left">
              <Avatar
                url={profile.avatarUrl}
                name={profile.displayName || profile.username}
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1
                    className="wordmark text-4xl sm:text-5xl leading-none"
                    style={{ textShadow: "none" }}
                  >
                    {profile.displayName || profile.username}
                  </h1>
                  {profile.accountType === "curator" && (
                    <span
                      className="inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.28em]"
                      style={{
                        background:
                          "color-mix(in oklab, var(--cyber-magenta) 22%, transparent)",
                        color: "var(--cyber-magenta)",
                        boxShadow:
                          "inset 0 0 0 1px var(--cyber-magenta)",
                      }}
                    >
                      Curator
                    </span>
                  )}
                </div>
                <p className="mt-2 font-mono text-sm text-[color:var(--cyber-cyan)]">
                  @{profile.username}
                </p>
                {profile.bio && (
                  <p className="mt-3 max-w-xl text-sm text-foreground/85">
                    {profile.bio}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-center gap-5 text-[11px] uppercase tracking-[0.22em] text-muted-foreground sm:justify-start">
                  <span>
                    <strong className="text-foreground">
                      {profile.followerCount}
                    </strong>{" "}
                    followers
                  </span>
                  <span>
                    <strong className="text-foreground">
                      {profile.followingCount}
                    </strong>{" "}
                    following
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {profile.isSelf ? (
                    <button
                      type="button"
                      onClick={() => setEditing((e) => !e)}
                      className="inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] transition-colors"
                      style={{
                        borderColor:
                          "color-mix(in oklab, var(--cyber-cyan) 60%, var(--border))",
                        color: "var(--cyber-cyan)",
                      }}
                    >
                      {editing ? "Close" : "Edit Profile"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={followMutation.isPending}
                      onClick={() =>
                        followMutation.mutate(!profile.isFollowing)
                      }
                      className="inline-flex items-center gap-2 rounded-sm border px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] transition-colors disabled:opacity-60"
                      style={{
                        borderColor: profile.isFollowing
                          ? "var(--border)"
                          : "color-mix(in oklab, var(--cyber-lime) 60%, var(--border))",
                        background: profile.isFollowing
                          ? "transparent"
                          : "color-mix(in oklab, var(--cyber-lime) 15%, transparent)",
                        color: profile.isFollowing
                          ? "var(--foreground)"
                          : "var(--cyber-lime)",
                      }}
                    >
                      {followMutation.isPending
                        ? "…"
                        : profile.isFollowing
                          ? "Unfollow"
                          : "Follow"}
                    </button>
                  )}
                </div>
              </div>
            </header>

            {profile.isSelf && editing && (
              <EditForm
                initial={{
                  displayName: profile.displayName ?? "",
                  username: profile.username,
                  bio: profile.bio ?? "",
                }}
                onDone={async (newUsername) => {
                  setEditing(false);
                  await qc.invalidateQueries({ queryKey: ["currentUsername"] });
                  if (newUsername && newUsername !== profile.username) {
                    navigate({
                      to: "/profile/$username",
                      params: { username: newUsername },
                    });
                  } else {
                    qc.invalidateQueries({ queryKey: profileKey });
                  }
                }}
              />
            )}

            <div className="chrome-divider mx-auto mt-10 w-full max-w-3xl" />

            <div className="mx-auto mt-8 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2">
              {TABS.map((t) => {
                const active = tab === t.value;
                const count = (entries ?? []).filter(
                  (e) => e.status === t.value,
                ).length;
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
                    }}
                  >
                    {t.label}
                    <span className="text-muted-foreground">[{count}]</span>
                  </button>
                );
              })}
            </div>

            <section className="mt-10" aria-labelledby="profile-entries-heading">
              <h2 id="profile-entries-heading" className="sr-only">
                @{profile.username}'s entries
              </h2>
              {!profile.canViewEntries ? (
                <div className="mx-auto max-w-md py-12 text-center">
                  <p className="font-mono text-lg">Entries are private</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                    Follow @{profile.username} to see their activity
                  </p>
                </div>
              ) : eLoading ? (
                <div className="mx-auto max-w-md text-center text-muted-foreground">
                  Loading…
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="mx-auto max-w-md py-12 text-center">
                  <p className="font-mono text-lg">Nothing here</p>
                </div>
              ) : (
                <EntryGrid items={filteredEntries} onSelect={setSelected} />
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

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  return url ? (
    <img
      src={url}
      alt={name}
      className="h-24 w-24 rounded-sm object-cover sm:h-28 sm:w-28"
      style={{
        boxShadow:
          "0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 50%, var(--border)), 4px 4px 0 color-mix(in oklab, var(--cyber-magenta) 80%, transparent)",
      }}
    />
  ) : (
    <div
      className="flex h-24 w-24 items-center justify-center rounded-sm font-mono text-3xl sm:h-28 sm:w-28 sm:text-4xl"
      style={{
        background:
          "color-mix(in oklab, var(--cyber-magenta) 25%, transparent)",
        color: "var(--cyber-cyan)",
        boxShadow:
          "0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 60%, var(--border)), 4px 4px 0 color-mix(in oklab, var(--cyber-magenta) 80%, transparent)",
      }}
    >
      {initial}
    </div>
  );
}

function EditForm({
  initial,
  onDone,
}: {
  initial: { displayName: string; username: string; bio: string };
  onDone: (newUsername: string) => void;
}) {
  const save = useServerFn(updateProfile);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await save({
        data: {
          displayName: displayName || null,
          username,
          bio: bio || null,
        },
      });
      onDone(username);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-6 grid w-full max-w-xl gap-3 rounded-sm border border-border bg-card/70 p-4 backdrop-blur"
    >
      <Field label="Display name">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={120}
          className="input"
        />
      </Field>
      <Field label="Username">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={2}
          maxLength={40}
          pattern="[a-zA-Z0-9_]+"
          required
          className="input"
        />
      </Field>
      <Field label="Bio">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          className="input resize-none"
        />
      </Field>
      {err && (
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--cyber-magenta)]">
          {err}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-sm border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] disabled:opacity-60"
          style={{
            borderColor: "var(--cyber-cyan)",
            color: "var(--cyber-cyan)",
            background:
              "color-mix(in oklab, var(--cyber-cyan) 12%, transparent)",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <style>{`
        .input {
          width: 100%;
          background: color-mix(in oklab, var(--background) 60%, transparent);
          border: 1px solid var(--border);
          border-radius: 2px;
          padding: 8px 10px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 13px;
          color: var(--foreground);
        }
        .input:focus {
          outline: none;
          border-color: color-mix(in oklab, var(--cyber-cyan) 70%, var(--border));
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function EntryGrid({
  items,
  onSelect,
}: {
  items: ProfileEntry[];
  onSelect: (t: TmdbResult) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() =>
            onSelect({
              id: e.title.tmdbId,
              title: e.title.title,
              year: e.title.year ? String(e.title.year) : null,
              posterUrl: e.title.posterUrl,
              backdropUrl: e.title.backdropUrl,
              releaseDate: e.title.releaseDate,
              overview: e.title.overview ?? "",
              genreIds: [],
              mediaType: e.title.type,
            })
          }
          className="poster-card group block w-full text-left"
        >
          <div className="relative aspect-[2/3] w-full">
            {e.title.posterUrl ? (
              <img
                src={e.title.posterUrl}
                alt={e.title.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[oklch(0.12_0.02_280)] p-4 text-center">
                <span className="font-mono text-sm text-muted-foreground">
                  {e.title.title}
                </span>
              </div>
            )}
            {e.rating != null && (
              <div
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-bold backdrop-blur"
                style={{
                  background:
                    "color-mix(in oklab, var(--background) 75%, transparent)",
                  color: "var(--cyber-lime)",
                  boxShadow:
                    "inset 0 0 0 1px color-mix(in oklab, var(--cyber-lime) 50%, transparent)",
                }}
              >
                ★ {e.rating}/10
              </div>
            )}
          </div>
          <div className="p-3">
            <h3 className="line-clamp-2 text-sm font-medium">{e.title.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {e.title.year ?? "—"}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
