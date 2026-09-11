import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { createThread, listThreads, deleteThread } from "@/lib/chat.functions";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [
      { title: "Meeting chats | Smart Meeting & Note Summarizer" },
      {
        name: "description",
        content:
          "Type meeting chatter into a live chat window and turn any conversation into highlights and action items.",
      },
      { property: "og:title", content: "Meeting chats | Smart Meeting & Note Summarizer" },
      {
        property: "og:description",
        content: "Capture meeting chatter as it happens, then summarize the whole conversation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatIndex,
});

function ChatIndex() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchThreads = useServerFn(listThreads);
  const makeThread = useServerFn(createThread);
  const removeThread = useServerFn(deleteThread);

  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => fetchThreads(),
    enabled: Boolean(user),
  });

  const create = useMutation({
    mutationFn: () => makeThread({ data: {} }),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeThread({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["threads"] }),
  });

  return (
    <div className="min-h-screen bg-paper text-ink antialiased">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Chat capture</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
          Meeting chats
        </h1>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">
          Type the chatter as it happens; summarize the whole conversation when you're done.
        </p>

        {!loading && !user ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)]">
            <p className="flex-1 text-sm text-muted-foreground">
              Sign in to start a meeting chat.
            </p>
            <Link
              to="/auth"
              className="grid h-10 place-items-center rounded-xl bg-ink px-4 text-sm font-medium text-paper"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate()}
              className="mt-5 h-11 w-full rounded-xl bg-ink text-sm font-medium text-paper disabled:opacity-60"
            >
              {create.isPending ? "Opening…" : "Start a new meeting chat"}
            </button>

            <div className="mt-4 space-y-2">
              {threads.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">No chats yet.</p>
              )}
              {threads.data?.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)]"
                >
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: t.id }}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-faint">
                      {new Date(t.updatedAt).toLocaleString()}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove.mutate(t.id)}
                    aria-label={`Delete ${t.title}`}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint transition-colors hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
