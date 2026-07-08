import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Shared workout progress + per-profile reminder settings for the two brothers.
// Family-passcode gated: the passcode is the key to reading/writing progress, so
// strangers who find the public URL can't touch the data. Tables stay RLS-locked;
// this function (service role) is the only writer.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function loadConfig(): Promise<Record<string, string>> {
  const { data } = await admin.from("app_config").select("key, value");
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  const cfg = await loadConfig();
  const passcode = String(body.passcode ?? "");
  if (!cfg.family_passcode || passcode !== cfg.family_passcode) {
    return json({ error: "unauthorized" }, 401);
  }

  const action = body.action as string;
  try {
    if (action === "pull") {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name, reminder_enabled, reminder_hour, reminder_min, tz, sort")
        .order("sort");
      const { data: progress } = await admin
        .from("progress")
        .select("profile, program, days, sets, updated_at");
      return json({ success: true, profiles: profiles ?? [], progress: progress ?? [] });
    }

    if (action === "push-progress") {
      const profile = body.profile as string | undefined;
      if (!profile) return json({ error: "no profile" }, 400);
      // Partial: only the arrays provided are written, so day-completion syncs
      // (main screen) and set-logging (strength sheet) never clobber each other.
      const row: Record<string, unknown> = {
        profile,
        program: (body.program as string) || "10week",
        updated_at: new Date().toISOString(),
      };
      if (Array.isArray(body.days)) row.days = body.days;
      if (Array.isArray(body.sets)) row.sets = body.sets;
      const { error } = await admin.from("progress").upsert(row);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "set-reminder") {
      const profile = body.profile as string | undefined;
      if (!profile) return json({ error: "no profile" }, 400);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.hour === "number") patch.reminder_hour = Math.max(0, Math.min(23, body.hour | 0));
      if (typeof body.min === "number") patch.reminder_min = [0, 15, 30, 45].includes(body.min as number) ? body.min : 0;
      if (typeof body.enabled === "boolean") patch.reminder_enabled = body.enabled;
      const { error } = await admin.from("profiles").update(patch).eq("id", profile);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
