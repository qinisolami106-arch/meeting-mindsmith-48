import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  notes: z.string().min(20, "Paste at least a few lines of notes first."),
  tone: z.enum(["professional", "casual", "concise"]),
});

export type ActionItem = { task: string; owner: string | null; done: boolean };
export type SummaryResult = {
  highlights: string[];
  actionItems: ActionItem[];
  emailSubject: string;
  emailBody: string;
};

const TONE_GUIDE: Record<string, string> = {
  professional: "Formal, polished, suitable for a workplace email to the whole team.",
  casual: "Friendly and relaxed, like a note to close teammates.",
  concise: "Extremely brief — short sentences, no filler.",
};

export const summarizeNotes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<SummaryResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI connection is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a workplace meeting-notes summarizer. Return ONLY valid JSON with keys: " +
              'highlights (array of 3-6 short bullet strings, no numbering), ' +
              "actionItems (array of objects: task (short imperative string), owner (person name or null if unknown), done (always false)), " +
              "emailSubject (string), emailBody (string, plain text, ready to paste, greeting and sign-off included). " +
              `Tone for the email: ${TONE_GUIDE[data.tone]} Base everything strictly on the notes; do not invent facts.`,
          },
          { role: "user", content: data.notes.slice(0, 12000) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`The summarizer could not complete the request (${res.status}). ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from the summarizer.");

    const parsed = JSON.parse(content);
    return {
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String).slice(0, 8) : [],
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.slice(0, 10).map((a: any) => ({
            task: String(a.task ?? ""),
            owner: a.owner ? String(a.owner) : null,
            done: false,
          }))
        : [],
      emailSubject: String(parsed.emailSubject ?? "Meeting follow-up"),
      emailBody: String(parsed.emailBody ?? ""),
    };
  });
