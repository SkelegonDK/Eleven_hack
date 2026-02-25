import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    plan: v.union(
      v.literal("free"),
      v.literal("casual"),
      v.literal("daily"),
      v.literal("power")
    ),
    minutesUsed: v.number(),
    freeTrialMinutesUsed: v.number(),
    billingPeriodStart: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  conversations: defineTable({
    clerkId: v.string(),
    startedAt: v.number(),
    durationSeconds: v.number(),
    mode: v.string(),
    agentId: v.string(),
  }).index("by_clerkId", ["clerkId"]),
});
