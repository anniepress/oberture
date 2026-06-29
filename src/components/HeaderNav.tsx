import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUsername } from "@/lib/profile.functions";

type NavItem = {
  to: string;
  label: string;
  dot: string;
  match: string;
  params?: { username: string };
};

function isNavActive(pathname: string, match: string) {
  return match === "/"
    ? pathname === "/"
    : pathname === match || pathname.startsWith(match + "/");
}

function NavLink({
  item,
  pathname,
  className,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const isActive = isNavActive(pathname, item.match);

  return (
    <Link
      {...(item as any)}
      onClick={onNavigate}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] backdrop-blur transition-colors"
      }
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
        style={{ background: item.dot, boxShadow: `0 0 8px ${item.dot}` }}
      />
      {item.label}
    </Link>
  );
}

export function HeaderNav() {
  const [authed, setAuthed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const getUsername = useServerFn(getCurrentUsername);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setAuthed(!!s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const { data: me } = useQuery({
    queryKey: ["currentUsername"],
    queryFn: () => getUsername(),
    enabled: authed,
    staleTime: 5 * 60 * 1000,
  });

  if (!authed) return null;

  const profileTo = me?.username
    ? { to: "/profile/$username" as const, params: { username: me.username } }
    : { to: "/profile" as const };

  const items: NavItem[] = [
    { to: "/" as const, label: "Search", dot: "var(--cyber-cyan)", match: "/" },
    { to: "/library" as const, label: "Library", dot: "var(--cyber-lime)", match: "/library" },
    { to: "/feed" as const, label: "Feed", dot: "var(--cyber-magenta)", match: "/feed" },
    { ...profileTo, label: "Profile", dot: "var(--cyber-cyan)", match: "/profile" },
  ];

  return (
    <>
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {items.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} />
        ))}
      </div>

      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex items-center gap-2 rounded-sm border border-border bg-card/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground backdrop-blur transition-colors hover:border-[color-mix(in_oklab,var(--cyber-cyan)_60%,var(--border))] hover:text-[color:var(--cyber-cyan)]"
          aria-label="Navigation menu"
          aria-expanded={menuOpen}
        >
          <Menu className="h-3.5 w-3.5" />
          Menu
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <div className="absolute right-0 z-50 mt-2 flex w-48 flex-col gap-1 rounded-sm border border-border bg-card/95 p-2 backdrop-blur shadow-[0_0_24px_color-mix(in_oklab,var(--cyber-magenta)_25%,transparent)]">
              {items.map((item) => (
                <NavLink
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  className="inline-flex w-full items-center gap-2 rounded-sm border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] backdrop-blur transition-colors"
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
