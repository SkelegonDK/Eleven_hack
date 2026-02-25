import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const convexUrl = process.env.CONVEX_URL || "";

let convexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is not set");
    }
    convexClient = new ConvexHttpClient(convexUrl);
  }
  return convexClient;
}

/** Plan minute limits */
const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  casual: 30,
  daily: 120,
  power: 300,
};

export interface UsageCheckResult {
  allowed: boolean;
  minutesUsed: number;
  minutesLimit: number;
  plan: string;
  message?: string;
}

/** Check if a user has remaining minutes on their plan */
export async function checkUsage(clerkId: string): Promise<UsageCheckResult> {
  const client = getConvexClient();

  // Ensure user exists
  await client.mutation(api.users.getOrCreateUser, { clerkId });

  const usage = await client.query(api.users.getUsage, { clerkId });

  const allowed = usage.minutesUsed < usage.minutesLimit;

  return {
    allowed,
    minutesUsed: usage.minutesUsed,
    minutesLimit: usage.minutesLimit,
    plan: usage.plan,
    message: allowed
      ? undefined
      : usage.plan === "free"
        ? "Free trial minutes used up. Subscribe to continue."
        : "Monthly minutes used up. Upgrade your plan for more.",
  };
}

/** Record minutes used after a conversation */
export async function recordUsage(
  clerkId: string,
  durationSeconds: number,
  mode: string,
  agentId: string
): Promise<void> {
  const client = getConvexClient();
  const minutes = Math.ceil(durationSeconds / 60);

  await client.mutation(api.users.addMinutesUsed, { clerkId, minutes });
  await client.mutation(api.conversations.logConversation, {
    clerkId,
    startedAt: Date.now() - durationSeconds * 1000,
    durationSeconds,
    mode,
    agentId,
  });
}
