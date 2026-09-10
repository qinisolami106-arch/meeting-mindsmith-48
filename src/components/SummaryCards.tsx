import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import type { Meeting } from "@/lib/meetings.functions";
import { emailFollowUp, RECIPIENT } from "@/lib/email.functions";

export function SummaryCards({ meeting }: { meeting: Meeting }) {
  const [checked, setChecked] = useState<boolean[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setChecked(meeting.actionItems.map((a) => a.done));
  }, [meeting]);

  const send = useServerFn(emailFollowUp);
  const emailing = useMutation({ mutationFn: () => send({ data: { id: meeting.id } }) });

  const copyEmail = async () => {
    await navigator.clipboard.writeText(`Subject: ${meeting.emailSubject}\n\n${meeting.emailBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const openCount = checked.filter((c) => !c).length;
  const hasSlots =
    meeting.attendees.length > 0 ||
    meeting.agenda.length > 0 ||
    meeting.startTime ||
    meeting.endTime;

  return (
    <div className="mt-3 space-y-3">
      {hasSlots && (
        <article className="animate-rise rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">
              {meeting.title}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-wide text-accent-blue">
              Details
            </span>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint">
                Time
              </dt>
              <dd className="text-ink">
                {meeting.startTime || "—"}
                {meeting.endTime ? ` – ${meeting.endTime}` : ""}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint">
                Attendees
              </dt>
              <dd className="text-ink">
                {meeting.attendees.length ? meeting.attendees.join(", ") : "—"}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint">
                Agenda
              </dt>
              <dd className="text-ink">{meeting.agenda.length ? meeting.agenda.join(" · ") : "—"}</dd>
            </div>
          </dl>
        </article>
      )}

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
          {meeting.highlights.map((h, i) => (
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
          {meeting.actionItems.map((a, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="sr-only"
                checked={checked[i] ?? false}
                onChange={() => setChecked((prev) => prev.map((c, j) => (j === i ? !c : c)))}
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
              <span className={checked[i] ? "text-muted-foreground line-through" : ""}>{a.task}</span>
              {a.owner && (
                <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">{a.owner}</span>
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
        <p className="mt-3 font-mono text-[11px] text-faint">Subject: {meeting.emailSubject}</p>
        <p className="mt-2 whitespace-pre-wrap text-pretty text-sm leading-relaxed text-muted-foreground">
          {meeting.emailBody}
        </p>

        <button
          type="button"
          disabled={emailing.isPending}
          onClick={() => emailing.mutate()}
          className="mt-4 h-10 w-full rounded-xl bg-accent-blue text-[13px] font-medium text-paper transition-opacity disabled:opacity-60"
        >
          {emailing.isPending
            ? "Sending…"
            : emailing.isSuccess
              ? `Sent to ${RECIPIENT}`
              : "Send it to my inbox"}
        </button>
        {emailing.isError && (
          <p className="mt-2 rounded-xl bg-destructive/8 p-3 text-[12px] leading-relaxed text-destructive outline-1 -outline-offset-1 outline-destructive/20">
            {(emailing.error as Error).message}
          </p>
        )}
      </article>
    </div>
  );
}
