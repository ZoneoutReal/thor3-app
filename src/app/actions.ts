"use server";

import webpush from "web-push";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const SUB_FILE = join(process.cwd(), ".push-subscription.json");

webpush.setVapidDetails(
  "mailto:jonathan.salotti68124@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function loadSubscription(): webpush.PushSubscription | null {
  if (!existsSync(SUB_FILE)) return null;
  try {
    return JSON.parse(readFileSync(SUB_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function saveSubscription(sub: webpush.PushSubscription | null) {
  if (sub) {
    writeFileSync(SUB_FILE, JSON.stringify(sub, null, 2));
  } else if (existsSync(SUB_FILE)) {
    writeFileSync(SUB_FILE, "");
  }
}

export async function subscribeUser(sub: webpush.PushSubscription) {
  saveSubscription(sub);
  return { success: true };
}

export async function unsubscribeUser() {
  saveSubscription(null);
  return { success: true };
}

export async function sendNotification(message: string) {
  const sub = loadSubscription();
  if (!sub) {
    return { success: false, error: "No subscription" };
  }

  try {
    await webpush.sendNotification(
      sub,
      JSON.stringify({
        title: "THOR3 Trainer",
        body: message,
        icon: "/icon-192.png",
        tag: "thor3-reminder",
      })
    );
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to send";
    console.error("Push failed:", msg);
    return { success: false, error: msg };
  }
}
