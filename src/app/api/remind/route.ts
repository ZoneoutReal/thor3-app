import { sendNotification } from "@/app/actions";

const MESSAGES = [
  "Time to train. No shortcuts.",
  "Get after it. Today's workout is waiting.",
  "Selection doesn't care about excuses.",
  "Another day, another opportunity to get better.",
  "The only easy day was yesterday.",
  "Discipline equals freedom. Get moving.",
];

export async function GET(request: Request) {
  const auth = new URL(request.url).searchParams.get("key");
  if (auth !== (process.env.REMIND_KEY || "thor3")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const result = await sendNotification(msg);
  return Response.json(result);
}
