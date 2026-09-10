import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SummarizeInput = z.object({
  notes: z.string().min(20, "Add at least a few lines of notes first."),
  tone: z.enum(["professional", "casual", "concise"]),
  title: z.string().optional(),
});

export type ActionItem = { task: string; owner: string | null; done: boolean };

export type Meeting = {
  id: string;
  title: string;
  tone: string;
  notes: string;
  highlights: string[];
  actionItems: ActionItem[];
  emailSubject: string;
  emailBody: string;
  attendees: string[];
  agenda: string[];
  startTime: string;
  endTime: string;
  createdAt: string;
};

const TONE_GUIDE: Record<string, string> = {
  professional: "Formal, polished, suitable for a workplace email to the whole team.",
  casual: "Friendly and relaxed, like a note to close teammates.",
  concise: "Extremely brief — short sentences, no filler.",
};

function toMeeting(row: any): Meeting {
  return {
    id: row.id,
    title: row.title,
    tone: row.tone,
    notes: row.notes,
    highlights: Array.isArray(row.highlights) ? row.highlights.map(String) : [],
    actionItems: Array.isArray(row.action_items)
      ? row.action_items.map((a: any) => ({
          task: String(a?.task ?? ""),
          owner: a?.owner ? String(a.owner) : null,
          done: Boolean(a?.done),
        }))
      : [],
    emailSubject: row.email_subject ?? "",
    emailBody: row.email_body ?? "",
    attendees: row.attendees ?? [],
    agenda: row.agenda ?? [],
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    createdAt: row.created_at,
  };
}

export const summarizeNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SummarizeInput.parse(input))
  .handler(async ({ data, context }): Promise<Meeting> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI connection is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a workplace meeting-notes summarizer. Return ONLY valid JSON with keys: " +
              "title (short meeting title, max 6 words), " +
              "attendees (array of person names mentioned as present, empty array if none), " +
              "agenda (array of short agenda-item strings), " +
              "startTime (string like '10:00' or empty string if not stated), " +
              "endTime (string or empty string), " +
              "highlights (array of 3-6 short bullet strings, no numbering), " +
              "actionItems (array of objects: task (short imperative string), owner (person name or null), done (always false)), " +
              "emailSubject (string), emailBody (string, plain text, greeting and sign-off included). " +
              `Tone for the email: ${TONE_GUIDE[data.tone]} Base everything strictly on the notes; do not invent facts. ` +
              "If the notes use a template with empty slots, fill those slots only from what the notes actually say.",
          },
          { role: "user", content: data.notes.slice(0, 12000) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `The summarizer could not complete the request (${res.status}). ${text.slice(0, 200)}`,
      );
    }

    const json: any = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from the summarizer.");
    const parsed = JSON.parse(content);

    const row = {
      user_id: context.userId,
      title: String(data.title || parsed.title || "Untitled meeting").slice(0, 120),
      tone: data.tone,
      notes: data.notes,
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String).slice(0, 8) : [],
      action_items: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.slice(0, 12).map((a: any) => ({
            task: String(a?.task ?? ""),
            owner: a?.owner ? String(a.owner) : null,
            done: false,
          }))
        : [],
      email_subject: String(parsed.emailSubject ?? "Meeting follow-up"),
      email_body: String(parsed.emailBody ?? ""),
      attendees: Array.isArray(parsed.attendees) ? parsed.attendees.map(String).slice(0, 25) : [],
      agenda: Array.isArray(parsed.agenda) ? parsed.agenda.map(String).slice(0, 20) : [],
      start_time: String(parsed.startTime ?? ""),
      end_time: String(parsed.endTime ?? ""),
    };

    const { data: saved, error } = await context.supabase
      .from("summaries")
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(`Could not save this meeting: ${error.message}`);
    return toMeeting(saved);
  });

export const listMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Meeting[]> => {
    const { data, error } = await context.supabase
      .from("summaries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toMeeting);
  });

export const deleteMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("summaries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
