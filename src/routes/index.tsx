import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  summarizeNotes,
  listMeetings,
  deleteMeeting,
  type Meeting,
} from "@/lib/meetings.functions";
import { startRecording, transcribe, type Recorder } from "@/lib/recorder";
import { SummaryCards } from "@/components/SummaryCards";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Meeting & Note Summarizer | AI Workplace Assistant" },
      {
        name: "description",
        content:
          "Paste raw meeting notes and get key highlights, an action-item checklist, and a ready-to-send follow-up email.",
      },
      { property: "og:title", content: "Smart Meeting & Note Summarizer" },
      {
        property: "og:description",
        content:
          "Turn messy meeting notes into highlights, action items, and a drafted follow-up email in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TONES = [
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "concise", label: "Concise" },
] as const;

type Tone = (typeof TONES)[number]["id"];

const TEMPLATE = `Meeting: 
Date: 
Start time: 
End time: 
Attendees: 
Agenda:
1. 
2. 
3. 
Notes:
- `;

const SAMPLE =
  "Kickoff for the Q3 launch. Priya owns the pricing doc by Friday. We're dropping the self-serve tier for now. Marcus is chasing the enterprise SSO spec — flagged a security concern with token refresh. Need a demo script before the 14th. Decided to keep onboarding at three steps. Budget is capped at 40k.";

function Index() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(SAMPLE);
  const [tone, setTone] = useState<Tone>("professional");
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [recorder, setRecorder] = useState<Recorder | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!recorder) return;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recorder]);

  const startVoice = async () => {
    setVoiceError(null);
    try {
      setRecorder(await startRecording());
    } catch {
      setVoiceError("Microphone access is needed to record.");
    }
  };

  const stopVoice = async () => {
    if (!recorder) return;
    const blob = await recorder.stop();
    setRecorder(null);
    setTranscribing(true);
    try {
      const text = await transcribe(blob);
      if (text.trim()) {
        setNotes((prev) => (prev.trim() ? `${prev.trim()}\n${text.trim()}` : text.trim()));
      } else {
        setVoiceError("Nothing was picked up — try recording again.");
      }
    } catch (e) {
      setVoiceError((e as Error).message);
    } finally {
      setTranscribing(false);
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const run = useServerFn(summarizeNotes);
  const fetchHistory = useServerFn(listMeetings);
  const removeMeeting = useServerFn(deleteMeeting);

  const history = useQuery({
    queryKey: ["meetings"],
    queryFn: () => fetchHistory(),
    enabled: Boolean(user),
  });

  const mutation = useMutation({
    mutationFn: (vars: { notes: string; tone: Tone }) => run({ data: vars }),
    onSuccess: (data: Meeting) => {
      setMeeting(data);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeMeeting({ data: { id } }),
    onSuccess: (_r, id) => {
      if (meeting?.id === id) setMeeting(null);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  return (
    <div className="min-h-screen bg-paper text-ink antialiased selection:bg-accent-blue/15">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 pt-5 pb-14">
        {!loading && !user && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)]">
            <p className="flex-1 text-pretty text-sm text-muted-foreground">
              Sign in to summarize meetings and keep every one of them in your history.
            </p>
            <Link
              to="/auth"
              className="grid h-10 place-items-center rounded-xl bg-ink px-4 text-sm font-medium text-paper"
            >
              Sign in
            </Link>
          </div>
        )}

        <section className="animate-rise">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">(a) Capture</p>
          <h1 className="mt-1 text-balance font-display text-2xl font-semibold tracking-tight">
            Turn raw notes into a filed record.
          </h1>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">
            Paste the messy transcript; get a clean, shareable set of index cards.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="notes" className="block text-[13px] font-medium text-ink">
              Raw notes
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setNotes((prev) => (prev.trim() ? `${TEMPLATE}\n${prev.trim()}` : TEMPLATE))
                }
                className="h-9 rounded-xl bg-white px-3 text-[12px] font-medium text-muted-foreground outline-1 -outline-offset-1 outline-line transition-colors hover:text-ink"
              >
                Use meeting template
              </button>
              <button
                type="button"
                disabled={transcribing}
                onClick={recorder ? stopVoice : startVoice}
                aria-label={recorder ? "Stop recording" : "Record with microphone"}
                className={
                  recorder
                    ? "flex h-9 items-center gap-2 rounded-xl bg-destructive px-3 text-[12px] font-medium text-paper"
                    : "flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-[12px] font-medium text-muted-foreground outline-1 -outline-offset-1 outline-line transition-colors hover:text-ink disabled:opacity-60"
                }
              >
                <span
                  className={
                    recorder
                      ? "size-2 animate-pulse rounded-full bg-paper"
                      : "size-2 rounded-full bg-accent-blue"
                  }
                />
                {transcribing ? "Transcribing…" : recorder ? `Stop · ${mmss}` : "Record"}
              </button>
            </div>
          </div>
          {voiceError && (
            <p className="mt-2 rounded-xl bg-destructive/8 p-3 text-[12px] leading-relaxed text-destructive outline-1 -outline-offset-1 outline-destructive/20">
              {voiceError}
            </p>
          )}
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1.5 h-48 w-full resize-none rounded-2xl bg-white px-3.5 py-3 text-sm leading-relaxed text-ink shadow-[var(--shadow-soft)] outline-1 -outline-offset-1 outline-line placeholder:text-faint focus:outline-2 focus:outline-accent-blue/50"
            placeholder="Paste meeting notes, transcript, or scattered thoughts…"
          />

          <p className="mt-4 text-[13px] font-medium text-ink">Tone</p>
          <div className="mt-1.5 flex gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                aria-pressed={tone === t.id}
                className={
                  tone === t.id
                    ? "h-10 flex-1 rounded-xl bg-accent-blue text-sm font-medium text-paper"
                    : "h-10 flex-1 rounded-xl bg-white text-sm font-medium text-muted-foreground outline-1 -outline-offset-1 outline-line transition-colors hover:text-ink"
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={mutation.isPending || !user}
            onClick={() => mutation.mutate({ notes, tone })}
            className="mt-4 h-12 w-full rounded-2xl bg-ink text-sm font-medium text-paper shadow-[var(--shadow-soft)] transition-opacity disabled:opacity-60"
          >
            {mutation.isPending ? "Filing your notes…" : "Summarize & Generate Action Items"}
          </button>

          {mutation.isError && (
            <p className="mt-3 rounded-xl bg-destructive/8 p-3 text-[12px] leading-relaxed text-destructive outline-1 -outline-offset-1 outline-destructive/20">
              {(mutation.error as Error).message}
            </p>
          )}
        </section>

        {meeting && (
          <section className="mt-7">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                (b) Filed record
              </p>
              <p className="font-mono text-[10px] text-faint">{meeting.title}</p>
            </div>
            <SummaryCards meeting={meeting} />
          </section>
        )}

        {user && (
          <section className="mt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              (c) History
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">
              Past meetings
            </h2>
            <div className="mt-3 space-y-2">
              {history.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {history.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nothing filed yet — your summaries will collect here.
                </p>
              )}
              {history.data?.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMeeting(m);
                      setNotes(m.notes);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium text-ink">{m.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-faint">
                      {new Date(m.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {m.tone}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(m.id)}
                    aria-label={`Delete ${m.title}`}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint transition-colors hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-ink/[0.04] p-3.5 outline-1 -outline-offset-1 outline-line">
          <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-accent-blue/12">
            <span className="font-mono text-[11px] leading-none text-accent-blue">i</span>
          </span>
          <p className="text-pretty text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-ink">Responsible AI:</span> Always review generated
            summaries before sharing with your team.
          </p>
        </div>
      </main>
    </div>
  );
}
