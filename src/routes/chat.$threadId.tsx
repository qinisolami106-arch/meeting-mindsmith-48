import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SummaryCards } from "@/components/SummaryCards";
import { useAuth } from "@/hooks/useAuth";
import { addMessage, listMessages, renameThread } from "@/lib/chat.functions";
import { summarizeNotes, type Meeting } from "@/lib/meetings.functions";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Meeting chat | Smart Meeting & Note Summarizer" },
      {
        name: "description",
        content:
          "Capture meeting chatter line by line, then pull highlights and action items straight from the conversation.",
      },
      { property: "og:title", content: "Meeting chat" },
      {
        property: "og:description",
        content: "Type meeting chatter and summarize the conversation into a filed record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatThread,
});

const TONES = ["professional", "casual", "concise"] as const;
type Tone = (typeof TONES)[number];

function ChatThread() {
  const { threadId } = Route.useParams();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [speaker, setSpeaker] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [meeting, setMeeting] = useState<Meeting | null>(null);

  const fetchMessages = useServerFn(listMessages);
  const postMessage = useServerFn(addMessage);
  const rename = useServerFn(renameThread);
  const run = useServerFn(summarizeNotes);

  const messages = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => fetchMessages({ data: { threadId } }),
    enabled: Boolean(user),
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  const send = useMutation({
    mutationFn: (content: string) =>
      postMessage({ data: { threadId, speaker: speaker.trim(), content } }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      inputRef.current?.focus();
    },
  });

  const saveTitle = useMutation({
    mutationFn: (next: string) => rename({ data: { id: threadId, title: next } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["threads"] }),
  });

  const summarize = useMutation({
    mutationFn: () => {
      const transcript = (messages.data ?? [])
        .map((m) => (m.speaker ? `${m.speaker}: ${m.content}` : m.content))
        .join("\n");
      return run({ data: { notes: transcript, tone, ...(title.trim() ? { title: title.trim() } : {}) } });
    },
    onSuccess: (data) => {
      setMeeting(data);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 pt-8">
          <p className="text-sm text-muted-foreground">Sign in to open this chat.</p>
          <Link
            to="/auth"
            className="mt-3 inline-grid h-10 place-items-center rounded-xl bg-ink px-4 text-sm font-medium text-paper"
          >
            Sign in
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink antialiased">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-14">
        <Link to="/chat" className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          ← All chats
        </Link>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && saveTitle.mutate(title.trim())}
          placeholder="Meeting title"
          className="mt-2 w-full bg-transparent font-display text-2xl font-semibold tracking-tight outline-none placeholder:text-faint"
        />

        <div className="mt-4 space-y-2">
          {messages.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing captured yet — start typing what's being said.
            </p>
          )}
          {messages.data?.map((m) => (
            <div key={m.id} className="rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)]">
              {m.speaker && (
                <p className="font-mono text-[10px] uppercase tracking-wide text-accent-blue">
                  {m.speaker}
                </p>
              )}
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{m.content}</p>
            </div>
          ))}
        </div>

        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send.mutate(text.trim());
          }}
        >
          <input
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value)}
            placeholder="Who's speaking? (optional)"
            className="h-10 w-full rounded-xl bg-white px-3.5 text-[13px] outline-1 -outline-offset-1 outline-line placeholder:text-faint focus:outline-2 focus:outline-accent-blue/50"
          />
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (text.trim()) send.mutate(text.trim());
              }
            }}
            placeholder="Type the chatter…"
            className="h-24 w-full resize-none rounded-2xl bg-white px-3.5 py-3 text-sm leading-relaxed shadow-[var(--shadow-soft)] outline-1 -outline-offset-1 outline-line placeholder:text-faint focus:outline-2 focus:outline-accent-blue/50"
          />
          <button
            type="submit"
            disabled={send.isPending || !text.trim()}
            className="h-10 w-full rounded-xl bg-accent-blue text-[13px] font-medium text-paper disabled:opacity-60"
          >
            {send.isPending ? "Adding…" : "Add to the chat"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl bg-ink/[0.04] p-3.5 outline-1 -outline-offset-1 outline-line">
          <p className="text-[13px] font-medium text-ink">Summarize this chat</p>
          <div className="mt-2 flex gap-2">
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                aria-pressed={tone === t}
                className={
                  tone === t
                    ? "h-9 flex-1 rounded-xl bg-accent-blue text-[13px] font-medium capitalize text-paper"
                    : "h-9 flex-1 rounded-xl bg-white text-[13px] font-medium capitalize text-muted-foreground outline-1 -outline-offset-1 outline-line"
                }
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={summarize.isPending || (messages.data?.length ?? 0) === 0}
            onClick={() => summarize.mutate()}
            className="mt-2 h-11 w-full rounded-xl bg-ink text-sm font-medium text-paper disabled:opacity-60"
          >
            {summarize.isPending ? "Filing this chat…" : "Summarize & Generate Action Items"}
          </button>
          {summarize.isError && (
            <p className="mt-2 rounded-xl bg-destructive/8 p-3 text-[12px] text-destructive outline-1 -outline-offset-1 outline-destructive/20">
              {(summarize.error as Error).message}
            </p>
          )}
        </div>

        {meeting && <SummaryCards meeting={meeting} />}
      </main>
    </div>
  );
}
