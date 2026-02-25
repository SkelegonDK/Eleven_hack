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

/**
 * Map Clerk Billing plan slugs to our internal plan names.
 * Update these slugs to match what you configure in Clerk Dashboard.
 */
const CLERK_PLAN_MAP: Record<string, "casual" | "daily" | "power"> = {
  // Clerk plan slugs (set these in Clerk Dashboard → Billing → Plans)
  casual_chatter: "casual",
  "casual-chatter": "casual",
  casual: "casual",
  daily_listener: "daily",
  "daily-listener": "daily",
  daily: "daily",
  power_podcaster: "power",
  "power-podcaster": "power",
  power: "power",
};

/**
 * Sync a Clerk billing event to the Convex users table.
 * Called from the /api/webhooks/clerk endpoint.
 */
export async function syncClerkPlan(
  clerkUserId: string,
  planSlug: string | null,
  isActive: boolean
): Promise<void> {
  const client = getConvexClient();

  // Ensure user exists
  await client.mutation(api.users.getOrCreateUser, { clerkId: clerkUserId });

  if (!isActive || !planSlug) {
    // Subscription canceled/ended → revert to free
    await client.mutation(api.users.updatePlan, {
      clerkId: clerkUserId,
      plan: "free",
    });
    return;
  }

  const plan = CLERK_PLAN_MAP[planSlug.toLowerCase()];
  if (!plan) {
    console.warn(`Unknown Clerk plan slug: "${planSlug}". Ignoring.`);
    return;
  }

  await client.mutation(api.users.updatePlan, {
    clerkId: clerkUserId,
    plan,
  });
}
