import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

Deno.serve(async (req) => {
  const { data: cfgRows } = await admin.from("app_config").select("key, value");
  const cfg = Object.fromEntries(
    (cfgRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  );

  // Cron-only: gated by a shared secret, not a JWT.
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== cfg.cron_secret) return json({ error: "unauthorized" }, 401);

  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, subscription");

  let sent = 0;
  let removed = 0;
  for (const row of subs ?? []) {
    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify({ title: "THOR3 Trainer", body: msg, tag: "thor3-reminder" })
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

  return json({ success: true, sent, removed });
});
