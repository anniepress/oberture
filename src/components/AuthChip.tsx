import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function AuthChip() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!user) {
    return (
      <Link
        to="/auth"
        className="inline-flex items-center gap-2 rounded-sm border border-border bg-card/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground backdrop-blur transition-colors hover:border-[color-mix(in_oklab,var(--cyber-cyan)_60%,var(--border))] hover:text-[color:var(--cyber-cyan)]"
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--cyber-magenta)", boxShadow: "0 0 8px var(--cyber-magenta)" }}
        />
        Sign in
      </Link>
    );
  }

  const email = user.email ?? "user";
  const initial = email[0]?.toUpperCase() ?? "U";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-sm border border-border bg-card/70 px-2 py-1.5 backdrop-blur transition-colors hover:border-[color-mix(in_oklab,var(--cyber-cyan)_60%,var(--border))]"
        aria-label="Account menu"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-sm text-[11px] font-bold"
          style={{
            background: "color-mix(in oklab, var(--cyber-magenta) 25%, transparent)",
            color: "var(--cyber-cyan)",
            boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 50%, transparent)",
          }}
        >
          {initial}
        </span>
        <span className="hidden sm:block max-w-[120px] truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {email}
        </span>
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-sm border border-border bg-card/95 p-2 backdrop-blur shadow-[0_0_24px_color-mix(in_oklab,var(--cyber-magenta)_25%,transparent)]">
            <div className="border-b border-border/60 px-2 pb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Signed in as
              <div className="mt-1 truncate text-foreground tracking-normal normal-case">{email}</div>
            </div>
            <button
              onClick={async () => {
                setOpen(false);
                await supabase.auth.signOut();
              }}
              className="mt-2 w-full rounded-sm px-2 py-1.5 text-left text-[11px] uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--cyber-magenta)_20%,transparent)] hover:text-[color:var(--cyber-cyan)]"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
