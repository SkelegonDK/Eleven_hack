import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Log a completed conversation */
export const logConversation = mutation({
  args: {
    clerkId: v.string(),
    startedAt: v.number(),
    durationSeconds: v.number(),
    mode: v.string(),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("conversations", args);
  },
});

/** Get conversation history for a user */
export const getConversations = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .order("desc")
      .take(50);
  },
});
