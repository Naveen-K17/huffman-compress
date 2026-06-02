import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listHistory = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("compression_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return { rows: data ?? [] };
});

export const addHistory = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      file_name: z.string().min(1).max(255),
      original_size: z.number().int().nonnegative(),
      compressed_size: z.number().int().nonnegative(),
      compression_ratio: z.number(),
      space_saving_pct: z.number(),
      original_hash: z.string().min(8).max(128),
      status: z.string().max(32).default("success"),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("compression_history").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHistory = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("compression_history").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
