import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export function AppHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-blue/10">
          <span className="font-mono text-xs font-medium text-accent-blue">¶</span>
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[15px] font-semibold tracking-tight">
            AI Workplace Productivity Assistant
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            Note triage · v0.4
          </p>
        </div>
        <nav className="ml-auto flex items-center gap-3">
          <Link
            to="/"
            className="font-mono text-[10px] uppercase tracking-wide text-faint transition-colors hover:text-ink [&.active]:text-ink"
          >
            Notes
          </Link>
          <Link
            to="/chat"
            className="font-mono text-[10px] uppercase tracking-wide text-faint transition-colors hover:text-ink [&.active]:text-ink"
          >
            Chat
          </Link>
          {user ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="font-mono text-[10px] uppercase tracking-wide text-faint transition-colors hover:text-ink"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/auth"
              className="font-mono text-[10px] uppercase tracking-wide text-accent-blue"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
