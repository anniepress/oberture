import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function LibraryNavLink() {
  const [authed, setAuthed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setAuthed(!!s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authed) return null;
  const isLibrary = pathname.startsWith("/library");
  const isHome = pathname === "/";

  return (
    <Link
      to={isLibrary ? "/" : "/library"}
      className="inline-flex items-center gap-2 rounded-sm border border-border bg-card/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground backdrop-blur transition-colors hover:border-[color-mix(in_oklab,var(--cyber-cyan)_60%,var(--border))] hover:text-[color:var(--cyber-cyan)]"
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: "var(--cyber-lime)",
          boxShadow: "0 0 8px var(--cyber-lime)",
        }}
      />
      {isLibrary ? "Search" : isHome ? "Library" : "Library"}
    </Link>
  );
}
