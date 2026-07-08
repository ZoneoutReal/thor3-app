// Client-side push helpers. These call the Supabase `push-subscribe` edge
// function, which owns the subscription table and sends via web-push/VAPID.
// Every call carries the family passcode; `subscribe` also tags the row with the
// current profile so Jon's phone and Brody's phone are two separate channels.

import { getPasscode, getProfileId } from "./profiles";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const FN_URL = `${SUPABASE_URL}/functions/v1/push-subscribe`;

async function callPush(payload: Record<string, unknown>) {
  if (!SUPABASE_URL) {
    return { success: false, error: "Supabase not configured" };
  }
  try {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ANON ? { apikey: ANON, Authorization: `Bearer ${ANON}` } : {}),
      },
      body: JSON.stringify({ passcode: getPasscode() ?? "", ...payload }),
    });
    return (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}

export function subscribeUser(subscription: PushSubscriptionJSON) {
  return callPush({ action: "subscribe", subscription, profile: getProfileId() });
}

export function unsubscribeUser(endpoint?: string) {
  return callPush({ action: "unsubscribe", endpoint });
}

export function sendTestNotification(endpoint: string) {
  return callPush({ action: "test", endpoint });
}
