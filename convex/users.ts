import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/** Minutes allowed per plan */
export const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  casual: 30,
  regular: 120,
  deep: 300,
};

/** Get or create a user record by Clerk ID */
export const getOrCreateUser = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) return existing;

    const now = Date.now();
    const id = await ctx.db.insert("users", {
      clerkId,
      plan: "free",
      minutesUsed: 0,
      freeTrialMinutesUsed: 0,
      billingPeriodStart: now,
    });

    return await ctx.db.get(id);
  },
});

/** Get user by Clerk ID (read-only) */
export const getUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();
  },
});

/** Get usage info for the current billing period (server-side, takes clerkId) */
export const getUsage = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!user) {
      return { minutesUsed: 0, minutesLimit: 5, plan: "free" as const };
    }

    const limit = PLAN_LIMITS[user.plan] ?? 5;

    if (user.plan === "free") {
      return {
        minutesUsed: user.freeTrialMinutesUsed,
        minutesLimit: limit,
        plan: user.plan,
      };
    }

    return {
      minutesUsed: user.minutesUsed,
      minutesLimit: limit,
      plan: user.plan,
    };
  },
});

/** Get usage for the authenticated user (frontend — uses ctx.auth, no clerkId needed) */
export const getMyUsage = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const clerkId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!user) {
      return { minutesUsed: 0, minutesLimit: 5, plan: "free" as const };
    }

    const limit = PLAN_LIMITS[user.plan] ?? 5;

    if (user.plan === "free") {
      return {
        minutesUsed: user.freeTrialMinutesUsed,
        minutesLimit: limit,
        plan: user.plan,
      };
    }

    return {
      minutesUsed: user.minutesUsed,
      minutesLimit: limit,
      plan: user.plan,
    };
  },
});

/** Ensure the authenticated user has a record (frontend — uses ctx.auth) */
export const ensureCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const clerkId = identity.subject;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) return existing;

    const now = Date.now();
    const id = await ctx.db.insert("users", {
      clerkId,
      plan: "free",
      minutesUsed: 0,
      freeTrialMinutesUsed: 0,
      billingPeriodStart: now,
    });

    return await ctx.db.get(id);
  },
});

/** Update the user's plan (called when subscription changes via Clerk webhook) */
export const updatePlan = mutation({
  args: {
    clerkId: v.string(),
    plan: v.union(
      v.literal("free"),
      v.literal("casual"),
      v.literal("regular"),
      v.literal("deep")
    ),
  },
  handler: async (ctx, { clerkId, plan }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!user) return;

    await ctx.db.patch(user._id, {
      plan,
      minutesUsed: 0,
      billingPeriodStart: Date.now(),
    });
  },
});

/** Add minutes used after a conversation ends */
export const addMinutesUsed = mutation({
  args: {
    clerkId: v.string(),
    minutes: v.number(),
  },
  handler: async (ctx, { clerkId, minutes }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!user) return;

    if (user.plan === "free") {
      await ctx.db.patch(user._id, {
        freeTrialMinutesUsed: user.freeTrialMinutesUsed + minutes,
      });
    } else {
      await ctx.db.patch(user._id, {
        minutesUsed: user.minutesUsed + minutes,
      });
    }
  },
});

/** Reset minutes used at the start of a new billing period */
export const resetBillingPeriod = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!user) return;

    await ctx.db.patch(user._id, {
      minutesUsed: 0,
      billingPeriodStart: Date.now(),
    });
  },
});
