import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "AI connection is not configured." }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid upload." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const file = form.get("file");
        if (!(file instanceof File) || file.size < 2048) {
          return new Response(
            JSON.stringify({ error: "That recording was empty — please try again." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        if (file.size > 24 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ error: "That recording is too long. Record a shorter clip." }),
            { status: 413, headers: { "Content-Type": "application/json" } },
          );
        }

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-transcribe");
        upstream.append("file", file, "recording.wav");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return new Response(
            JSON.stringify({ error: `Transcription failed (${res.status}). ${text.slice(0, 200)}` }),
            { status: res.status, headers: { "Content-Type": "application/json" } },
          );
        }

        const json: any = await res.json();
        return new Response(JSON.stringify({ text: String(json?.text ?? "") }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
