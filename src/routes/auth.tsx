import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Oberture — Sign in" },
      { name: "description", content: "Sign in to Oberture to track films and television." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Check your email to confirm your account.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ambient grid + glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklab, var(--cyber-cyan) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--cyber-cyan) 8%, transparent) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[560px] w-[560px] -translate-x-1/2 rounded-full blur-[120px] opacity-50"
        style={{ background: "radial-gradient(circle, var(--cyber-magenta), transparent 60%)" }}
      />

      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-10 pb-16">
        <Link
          to="/"
          className="self-start text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Return
        </Link>

        <header className="mt-10 text-center">
          <h1 className="wordmark text-5xl sm:text-6xl leading-none">Oberture</h1>
          <p className="mt-3 text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
            Access · Terminal
          </p>
          <div className="chrome-divider mx-auto mt-6 w-full max-w-xs" />
        </header>

        <div className="mt-10 rounded-sm border border-border bg-card/70 p-6 backdrop-blur shadow-[0_0_40px_color-mix(in_oklab,var(--cyber-magenta)_15%,transparent)]">
          <div className="mb-5 flex items-center justify-between text-[10px] uppercase tracking-[0.28em]">
            <span className="text-muted-foreground">
              {mode === "signin" ? "Authenticate" : "Enrol"}
            </span>
            <span
              className="flex items-center gap-1.5 text-muted-foreground/80"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: "var(--cyber-lime)",
                  boxShadow: "0 0 8px var(--cyber-lime)",
                }}
              />
              Link ▸ Live
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={setEmail}
              placeholder="you@signal.net"
            />
            <Field
              label="Password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />

            {error && (
              <p className="text-xs text-[color:var(--cyber-magenta)]" role="alert">
                ⚠ {error}
              </p>
            )}
            {notice && (
              <p className="text-xs text-[color:var(--cyber-cyan)]" role="status">
                ✓ {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-sm px-4 py-3 text-[11px] font-bold uppercase tracking-[0.3em] text-background transition-transform active:scale-[0.99] disabled:opacity-60"
              style={{
                background:
                  "linear-gradient(135deg, var(--cyber-magenta), var(--cyber-violet))",
                boxShadow:
                  "0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 50%, transparent), 0 0 24px color-mix(in oklab, var(--cyber-magenta) 50%, transparent)",
              }}
            >
              {loading ? "Transmitting…" : mode === "signin" ? "Enter" : "Create access"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[9px] uppercase tracking-[0.3em] text-muted-foreground/70">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-sm border border-border bg-background/40 px-4 py-2.5 text-[11px] uppercase tracking-[0.25em] text-foreground transition-colors hover:border-[color-mix(in_oklab,var(--cyber-cyan)_60%,var(--border))] hover:text-[color:var(--cyber-cyan)] disabled:opacity-60"
          >
            <GoogleGlyph />
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          {mode === "signin" ? "No credentials yet?" : "Already enrolled?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="text-[color:var(--cyber-cyan)] hover:text-[color:var(--cyber-magenta)] transition-colors"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-[color:var(--cyber-cyan)] focus:outline-none focus:ring-1 focus:ring-[color:var(--cyber-cyan)]"
      />
    </label>
  );
}

function GoogleGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-9 0-.6-.07-1.1-.15-1.6H12z"
      />
    </svg>
  );
}
