import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const RECIPIENT = "Qinisolami106@gmail.com";

/**
 * Sends the drafted follow-up email to the owner's inbox.
 * Delivery is switched on once the project's sending address is configured.
 */
export const emailFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("summaries")
      .select("email_subject, email_body, title")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("That meeting could not be found.");

    const { sendEmail } = await import("./email.server");
    return sendEmail({
      to: RECIPIENT,
      subject: row.email_subject || `Follow-up: ${row.title}`,
      text: row.email_body,
    });
  });
