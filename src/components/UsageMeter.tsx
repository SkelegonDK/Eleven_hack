import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";

export function UsageMeter() {
  const usage = useQuery(api.users.getMyUsage);

  if (!usage) return null;

  const percentage = Math.min(
    (usage.minutesUsed / usage.minutesLimit) * 100,
    100
  );
  const remaining = Math.max(usage.minutesLimit - usage.minutesUsed, 0);
  const isLow = percentage >= 80;
  const isExhausted = percentage >= 100;

  const planLabel =
    usage.plan === "free"
      ? "Free"
      : usage.plan === "casual"
        ? "Casual"
        : usage.plan === "regular"
          ? "Regular"
          : "Deep";

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {planLabel}
        </span>
        <span
          className={cn(
            "font-mono text-[10px]",
            isExhausted
              ? "text-destructive"
              : isLow
                ? "text-amber-500"
                : "text-muted-foreground"
          )}
        >
          {remaining} min left
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isExhausted
              ? "bg-destructive"
              : isLow
                ? "bg-amber-500"
                : "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
