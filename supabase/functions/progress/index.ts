import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

// Turn a completed-day id ("3-1" = week 3, weekday 1) into human text. Weekday
// index matches the app's DAY_LABELS (Mon..Sun); no program data needed here.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function describeDay(id: string): string {
  const m = id.match(/^(\d+)-(\d+)$/);
  if (!m) return "a workout";
  const wd = WEEKDAYS[parseInt(m[2], 10) - 1];
  return wd ? `Week ${m[1]}, ${wd}` : `Week ${m[1]}`;
}

// Best-effort family nudge: when a member marks a workout complete, push a
// notification to everyone else who shares the family code. Never throws into
// the write path (the caller wraps it); a failed send just drops.
async function notifyFamily(
  cfg: Record<string, string>,
  completer: string,
  newlyDone: string[],
  label?: string
) {
  if (!cfg.vapid_public || !cfg.vapid_private || !cfg.vapid_subject) return;

  const { data: me } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", completer)
    .maybeSingle();
  const first = ((me?.display_name as string) ?? "").split(" ")[0] || "Someone";
  // Prefer the client-sent workout label ("a 3-mile ruck") for a single
  // completion; otherwise fall back to the week/day or a plural count.
  const what =
    newlyDone.length > 1
      ? `${newlyDone.length} workouts`
      : label && label.trim()
      ? label.trim()
      : describeDay(newlyDone[0]);
  const body = `${first} finished ${what} 💪`;

  // Everyone in the family who wants activity pings, except the person who
  // logged it (and dev profiles).
  const { data: others } = await admin
    .from("profiles")
    .select("id, activity_notify")
    .neq("id", completer);
  const recipientIds = (others ?? [])
    .filter((o: { id: string; activity_notify: boolean | null }) => o.activity_notify !== false)
    .map((o: { id: string }) => o.id)
    .filter((id) => !String(id).startsWith("_"));
  if (recipientIds.length === 0) return;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, subscription")
    .in("profile", recipientIds);
  if (!subs || subs.length === 0) return;

  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
  for (const row of subs) {
    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify({ title: "Rukr", body, tag: `rukr-activity-${completer}-${newlyDone[0]}` })
      );
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
      }
    }
  }
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
  // Case-insensitive so the code works no matter how the phone keyboard cased it.
  const passcode = String(body.passcode ?? "").trim().toLowerCase();
  if (!cfg.family_passcode || passcode !== cfg.family_passcode.trim().toLowerCase()) {
    return json({ error: "unauthorized" }, 401);
  }

  const action = body.action as string;
  try {
    if (action === "pull") {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name, reminder_enabled, reminder_hour, reminder_min, tz, sort, activity_notify")
        .order("sort");
      const { data: progress } = await admin
        .from("progress")
        .select("profile, program, days, sets, logs, updated_at");
      // Hide throwaway dev profiles (id starts with "_") from the app.
      const real = (profiles ?? []).filter((p) => !String(p.id).startsWith("_"));
      const realProgress = (progress ?? []).filter((p) => !String(p.profile).startsWith("_"));
      return json({ success: true, profiles: real, progress: realProgress });
    }

    if (action === "push-progress") {
      const profile = body.profile as string | undefined;
      if (!profile) return json({ error: "no profile" }, 400);
      const program = (body.program as string) || "10week";

      // Detect newly-completed days by diffing the incoming `days` against what's
      // already stored, so we can nudge the family. Done BEFORE the upsert; a
      // resent/retried patch finds the day already present and won't re-notify.
      let newlyDone: string[] = [];
      let hadRow = false;
      if (Array.isArray(body.days)) {
        const { data: prev } = await admin
          .from("progress")
          .select("days")
          .eq("profile", profile)
          .eq("program", program)
          .maybeSingle();
        hadRow = !!prev;
        const before = new Set<string>(((prev?.days as string[]) ?? []));
        newlyDone = (body.days as string[]).filter((d) => !before.has(d));
      }

      // Partial: only the arrays provided are written, so day-completion syncs
      // (main screen) and set-logging (strength sheet) never clobber each other.
      const row: Record<string, unknown> = {
        profile,
        program,
        updated_at: new Date().toISOString(),
      };
      if (Array.isArray(body.days)) row.days = body.days;
      if (Array.isArray(body.sets)) row.sets = body.sets;
      if (body.logs && typeof body.logs === "object" && !Array.isArray(body.logs)) row.logs = body.logs;
      const { error } = await admin.from("progress").upsert(row);
      if (error) throw error;

      // Best-effort family notification. Only for real-time completions on an
      // existing row (skip a profile's first-ever sync and bulk backfills), and
      // never let a push failure fail the write the client is waiting on.
      if (hadRow && newlyDone.length >= 1 && newlyDone.length <= 3 && !profile.startsWith("_")) {
        // Use the client's label only when it matches the single day just completed.
        const hint = body.done as { id?: string; label?: string } | undefined;
        const label =
          newlyDone.length === 1 && hint?.id === newlyDone[0] ? hint?.label : undefined;
        try {
          await notifyFamily(cfg, profile, newlyDone, label);
        } catch {
          /* notification is best-effort */
        }
      }
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

    if (action === "set-activity") {
      const profile = body.profile as string | undefined;
      if (!profile) return json({ error: "no profile" }, 400);
      const { error } = await admin
        .from("profiles")
        .update({ activity_notify: !!body.enabled, updated_at: new Date().toISOString() })
        .eq("id", profile);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
