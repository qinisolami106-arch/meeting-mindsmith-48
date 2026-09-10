import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Thread = { id: string; title: string; updatedAt: string };
export type ChatMessage = { id: string; speaker: string; content: string; createdAt: string };

export const listThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Thread[]> => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((t: any) => ({ id: t.id, title: t.title, updatedAt: t.updated_at }));
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ title: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<Thread> => {
    const { data: row, error } = await context.supabase
      .from("chat_threads")
      .insert({ user_id: context.userId, title: data.title || "New meeting chat" })
      .select("id, title, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, title: row.title, updatedAt: row.updated_at };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chat_threads")
      .update({ title: data.title, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("chat_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ChatMessage[]> => {
    const { data: rows, error } = await context.supabase
      .from("chat_messages")
      .select("id, speaker, content, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((m: any) => ({
      id: m.id,
      speaker: m.speaker ?? "",
      content: m.content,
      createdAt: m.created_at,
    }));
  });

export const addMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        speaker: z.string().max(60).optional(),
        content: z.string().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ChatMessage> => {
    const { data: row, error } = await context.supabase
      .from("chat_messages")
      .insert({
        thread_id: data.threadId,
        user_id: context.userId,
        speaker: data.speaker ?? "",
        content: data.content,
      })
      .select("id, speaker, content, created_at")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase
      .from("chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.threadId);
    return { id: row.id, speaker: row.speaker ?? "", content: row.content, createdAt: row.created_at };
  });
