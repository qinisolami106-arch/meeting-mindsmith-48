import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | Smart Meeting & Note Summarizer" },
      {
        name: "description",
        content:
          "Sign in to save your meeting summaries, action items and follow-up emails to your account.",
      },
      { property: "og:title", content: "Sign in | Smart Meeting & Note Summarizer" },
      {
        property: "og:description",
        content: "Sign in to keep a history of every meeting you summarize.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setNotice("Check your email to confirm your address, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) setError("Google sign-in didn't work. Try again.");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4 text-ink">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          ← Back
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your meeting history is saved to your account.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-2.5">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-11 w-full rounded-xl bg-white px-3.5 text-sm outline-1 -outline-offset-1 outline-line placeholder:text-faint focus:outline-2 focus:outline-accent-blue/50"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-11 w-full rounded-xl bg-white px-3.5 text-sm outline-1 -outline-offset-1 outline-line placeholder:text-faint focus:outline-2 focus:outline-accent-blue/50"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-xl bg-ink text-sm font-medium text-paper disabled:opacity-60"
          >
            {busy ? "Just a moment…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={google}
          className="mt-2.5 h-11 w-full rounded-xl bg-white text-sm font-medium text-ink outline-1 -outline-offset-1 outline-line"
        >
          Continue with Google
        </button>

        {error && (
          <p className="mt-3 rounded-xl bg-destructive/8 p-3 text-[12px] text-destructive outline-1 -outline-offset-1 outline-destructive/20">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 rounded-xl bg-accent-blue/8 p-3 text-[12px] text-accent-blue">
            {notice}
          </p>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-[12px] text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
