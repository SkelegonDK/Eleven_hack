import { PricingTable } from "@clerk/clerk-react";

export function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl font-bold tracking-tight mb-2">
            Choose Your Plan
          </h2>
          <p className="font-mono text-sm text-muted-foreground">
            Start with 5 free minutes, then pick a plan that fits your listening style.
          </p>
        </div>
        <PricingTable />
      </div>
    </div>
  );
}
