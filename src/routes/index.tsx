import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { summarizeNotes, type ActionItem, type SummaryResult } from "@/lib/summarize.functions";
import { startRecording, transcribe, type Recorder } from "@/lib/recorder";

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

const SAMPLE =
  "Kickoff for the Q3 launch. Priya owns the pricing doc by Friday. We're dropping the self-serve tier for now. Marcus is chasing the enterprise SSO spec — flagged a security concern with token refresh. Need a demo script before the 14th. Decided to keep onboarding at three steps. Budget is capped at 40k.";

function Index() {
  const [notes, setNotes] = useState(SAMPLE);
  const [tone, setTone] = useState<Tone>("professional");
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [copied, setCopied] = useState(false);
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
        setNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${text.trim()}` : text.trim()));
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
  const mutation = useMutation({
    mutationFn: (vars: { notes: string; tone: Tone }) => run({ data: vars }),
    onSuccess: (data: SummaryResult) => {
      setResult(data);
      setChecked(data.actionItems.map(() => false));
    },
  });

  const copyEmail = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(`Subject: ${result.emailSubject}\n\n${result.emailBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const openCount = checked.filter((c) => !c).length;

  return (
    <div className="min-h-screen bg-paper text-ink antialiased selection:bg-accent-blue/15">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-blue/10">
            <span className="font-mono text-xs font-medium text-accent-blue">¶</span>
          </div>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-semibold tracking-tight">
              AI Workplace Productivity Assistant
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              Note triage · v0.3
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-5 pb-14">
        <section className="animate-rise">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">(a) Capture</p>
          <h1 className="mt-1 text-balance font-display text-2xl font-semibold tracking-tight">
            Turn raw notes into a filed record.
          </h1>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">
            Paste the messy transcript; get a clean, shareable set of index cards.
          </p>

          <label
            htmlFor="notes"
            className="mt-4 block text-[13px] font-medium text-ink"
          >
            Raw notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1.5 h-40 w-full resize-none rounded-2xl bg-white px-3.5 py-3 text-sm leading-relaxed text-ink shadow-[var(--shadow-soft)] outline-1 -outline-offset-1 outline-line placeholder:text-faint focus:outline-2 focus:outline-accent-blue/50"
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
            disabled={mutation.isPending}
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

        {result && (
          <section className="mt-7">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                (b) Filed record
              </p>
              <p className="font-mono text-[10px] text-faint">3 cards · just now</p>
            </div>

            <div className="mt-3 space-y-3">
              <article className="animate-rise rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-[15px] font-semibold tracking-tight">
                    Key Discussion Highlights
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-accent-blue">
                    Highlights
                  </span>
                </div>
                <ul className="mt-3 space-y-2.5 text-sm text-ink">
                  {result.highlights.map((h, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent-blue" />
                      {h}
                    </li>
                  ))}
                </ul>
              </article>

              <article
                className="animate-rise rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)]"
                style={{ animationDelay: "80ms" }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-[15px] font-semibold tracking-tight">
                    Action Items &amp; Next Steps
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-accent-blue">
                    {openCount} open
                  </span>
                </div>
                <div className="mt-3 space-y-3 text-sm">
                  {result.actionItems.map((a: ActionItem, i) => (
                    <label key={i} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={checked[i] ?? false}
                        onChange={() =>
                          setChecked((prev) => prev.map((c, j) => (j === i ? !c : c)))
                        }
                      />
                      <span
                        className={
                          checked[i]
                            ? "grid size-5 shrink-0 place-items-center rounded-md bg-accent-blue"
                            : "grid size-5 shrink-0 place-items-center rounded-md bg-white outline-1 -outline-offset-1 outline-line"
                        }
                      >
                        {checked[i] && <span className="text-[11px] leading-none text-paper">✓</span>}
                      </span>
                      <span className={checked[i] ? "text-muted-foreground line-through" : ""}>
                        {a.task}
                      </span>
                      {a.owner && (
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">
                          {a.owner}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </article>

              <article
                className="animate-rise rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)]"
                style={{ animationDelay: "160ms" }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-[15px] font-semibold tracking-tight">
                    Drafted Follow-up Email
                  </h2>
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="font-mono text-[10px] uppercase tracking-wide text-accent-blue"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-3 font-mono text-[11px] text-faint">
                  Subject: {result.emailSubject}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-pretty text-sm leading-relaxed text-muted-foreground">
                  {result.emailBody}
                </p>
              </article>
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
