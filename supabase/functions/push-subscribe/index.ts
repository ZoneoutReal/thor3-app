import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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
  const action = body.action as string;

  try {
    if (action === "subscribe") {
      const sub = body.subscription as { endpoint?: string } | undefined;
      if (!sub?.endpoint) return json({ error: "no subscription" }, 400);
      const { error } = await admin.from("push_subscriptions").upsert({
        endpoint: sub.endpoint,
        subscription: sub,
        user_agent: req.headers.get("user-agent"),
      });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "unsubscribe") {
      const endpoint = body.endpoint as string | undefined;
      if (endpoint) await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
      return json({ success: true });
    }

    if (action === "test") {
      const endpoint = body.endpoint as string | undefined;
      if (!endpoint) return json({ error: "no endpoint" }, 400);
      const { data } = await admin
        .from("push_subscriptions")
        .select("subscription")
        .eq("endpoint", endpoint)
        .maybeSingle();
      if (!data) return json({ error: "not subscribed" }, 404);
      const cfg = await loadConfig();
      webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
      await webpush.sendNotification(
        data.subscription,
        JSON.stringify({
          title: "THOR3 Trainer",
          body: "Test notification — THOR3 is wired up.",
          tag: "thor3-reminder",
        })
      );
      return json({ success: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
