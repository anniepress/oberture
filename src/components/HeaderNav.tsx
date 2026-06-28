import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUsername } from "@/lib/profile.functions";

type NavItem = { to: string; label: string; dot: string };

export function HeaderNav() {
  const [authed, setAuthed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const getUsername = useServerFn(getCurrentUsername);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setAuthed(!!s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: me } = useQuery({
    queryKey: ["currentUsername"],
    queryFn: () => getUsername(),
    enabled: authed,
    staleTime: 5 * 60 * 1000,
  });

  if (!authed) return null;

  const items: NavItem[] = [
    { to: "/", label: "Search", dot: "var(--cyber-cyan)" },
    { to: "/library", label: "Library", dot: "var(--cyber-lime)" },
    { to: "/feed", label: "Feed", dot: "var(--cyber-magenta)" },
    {
      to: me?.username ? `/profile/${me.username}` : "/profile",
      label: "Profile",
      dot: "var(--cyber-cyan)",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => {
        const isActive =
          it.to === "/"
            ? pathname === "/"
            : pathname === it.to || pathname.startsWith(it.to + "/");
        return (
          <Link
            key={it.label}
            to={it.to}
            className="inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] backdrop-blur transition-colors"
            style={{
              borderColor: isActive
                ? "color-mix(in oklab, var(--cyber-cyan) 60%, var(--border))"
                : "var(--border)",
              background: isActive
                ? "color-mix(in oklab, var(--cyber-cyan) 12%, transparent)"
                : "color-mix(in oklab, var(--card) 70%, transparent)",
              color: isActive ? "var(--cyber-cyan)" : "var(--foreground)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: it.dot, boxShadow: `0 0 8px ${it.dot}` }}
            />
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
