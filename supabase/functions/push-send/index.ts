import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Reminder tick. The cron hits this every 15 minutes; we send only to profiles
// whose own local reminder time matches this tick, so Jon and Brody each get
// their reminder at their own chosen time on their own channel. Cron-secret gated.

const MESSAGES = [
  "Time to train. No shortcuts.",
  "Get after it. Today's workout is waiting.",
  "Selection doesn't care about excuses.",
  "Another day, another opportunity to get better.",
  "The only easy day was yesterday.",
  "Discipline equals freedom. Get moving.",
];

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type Profile = {
  id: string;
  display_name: string;
  reminder_enabled: boolean;
  reminder_hour: number;
  reminder_min: number;
  tz: string | null;
};

// Current hour + 15-min bucket in a given IANA timezone (DST-correct).
function localHM(tz: string): { hour: number; bucket: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10) % 24;
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return { hour, bucket: Math.floor(minute / 15) * 15 };
}

Deno.serve(async (req) => {
  const { data: cfgRows } = await admin.from("app_config").select("key, value");
  const cfg = Object.fromEntries(
    (cfgRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  );

  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== cfg.cron_secret) return json({ error: "unauthorized" }, 401);

  // Optional { profile } in the body forces a send to one profile (manual/test),
  // bypassing the time check. The plain cron posts {} -> time-based selection.
  let forced: string | null = null;
  try {
    const b = await req.json();
    forced = (b?.profile as string) ?? null;
  } catch {
    /* no body */
  }

  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, reminder_enabled, reminder_hour, reminder_min, tz");

  const due = (profiles ?? []).filter((p: Profile) => {
    if (forced) return p.id === forced;
    if (!p.reminder_enabled) return false;
    const { hour, bucket } = localHM(p.tz || "America/Chicago");
    return hour === p.reminder_hour && bucket === (p.reminder_min ?? 0);
  });

  let sent = 0;
  let removed = 0;
  for (const p of due as Profile[]) {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("profile", p.id);
    const first = (p.display_name || "").split(" ")[0];
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    for (const row of subs ?? []) {
      try {
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify({
            title: "THOR3 Trainer",
            body: first ? `${first} — ${msg}` : msg,
            tag: `thor3-reminder-${p.id}`,
          })
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
          removed++;
        }
      }
    }
  }

  return json({ success: true, due: (due as Profile[]).map((p) => p.id), sent, removed });
});
