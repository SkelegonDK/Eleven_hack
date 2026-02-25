import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/authFetch";
import { SubjectSelector } from "./SubjectSelector";
import { ModeSelector, type ConversationMode } from "./ModeSelector";
import { PlayButton } from "./PlayButton";
import { ConversationView } from "./ConversationView";
import { Button } from "./ui/button";
import { AlertCircle } from "lucide-react";
import { SignedIn, UserButton, useAuth } from "@clerk/clerk-react";
import { UsageMeter } from "./UsageMeter";
import LightRays from "./LightRays";
import Aurora from './Aurora';

/**
 * SSR-safe hook to detect prefers-reduced-motion media query.
 * Returns true if the user prefers reduced motion or if we're on the server.
 * Defaults to false (full motion) on initial client render, then updates.
 */
function usePrefersReducedMotion(): boolean {
  // Default to false (full motion) to avoid hydration mismatch
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is available (client-side only)
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    
    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      // Legacy browsers (Safari < 14)
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return prefersReducedMotion;
}

const getModeColor = (mode: ConversationMode): string => {
  switch (mode) {
    case "fun":
      return "#F15BB5"; // pink
    case "edu":
      return "#00BBF9"; // blue
    case "deep":
      return "#9B5DE5"; // purple
    default:
      return "#00F5D4"; // mint
  }
};

// Map subject IDs to hex colors (using the "from" color from gradient)
const getSubjectColor = (subjectId: string): string => {
  const colorMap: Record<string, string> = {
    tech: "#00BBF9", // blue
    science: "#22c55e", // green-500
    history: "#FEE440", // yellow
    philosophy: "#9B5DE5", // purple
    business: "#94a3b8", // slate-400
    health: "#F15BB5", // pink
    arts: "#d946ef", // fuchsia-500
    upload: "#9B5DE5", // purple
  };
  return colorMap[subjectId] || "#3A29FF"; // default color
};

// Get Aurora colors based on selected subjects
const getAuroraColors = (selectedSubjects: string[]): string[] => {
  if (selectedSubjects.length === 0) {
    return ["#F15BB5", "#00BBF9", "#9B5DE5"]; // default colors
  }
  
  const colors = selectedSubjects.map(getSubjectColor);
  
  // Pad to 3 colors if needed
  while (colors.length < 3) {
    colors.push(colors[colors.length - 1] || "#3A29FF");
  }
  
  // Return only first 3 colors
  return colors.slice(0, 3);
};

interface LandingPageProps {
  /** Runtime opt-out to disable heavy effects (for low-end devices) */
  disableHeavyEffects?: boolean;
}

export function LandingPage({ disableHeavyEffects: disableHeavyEffectsProp }: LandingPageProps = {}) {
  const { getToken } = useAuth();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<ConversationMode>("fun");
  const [isLoading, setIsLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentSystemPrompt, setAgentSystemPrompt] = useState<string | null>(null);
  const [agentFirstMessage, setAgentFirstMessage] = useState<string | null>(null);
  
  // Runtime state for disabling heavy effects (can be toggled by user or set via prop)
  const [disableHeavyEffectsState, setDisableHeavyEffectsState] = useState(false);
  
  // SSR-safe detection of prefers-reduced-motion
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // Combine all sources: prop, state, or user preference
  const shouldReduceMotion = prefersReducedMotion || disableHeavyEffectsProp || disableHeavyEffectsState;

  const canStart = selectedSubjects.length > 0;
  
  // Compute Aurora colors based on selected subjects
  const auroraColors = useMemo(() => getAuroraColors(selectedSubjects), [selectedSubjects]);

  const handleStart = async () => {
    if (!canStart) return;
    
    setStartError(null);
    setIsLoading(true);
    
    try {
      // Create or get an agent for this conversation
      const response = await authFetch(getToken, "/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedMode,
          subjects: selectedSubjects,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start conversation");
      }
      
      const data = await response.json();
      setAgentId(data.agentId);
      setAgentSystemPrompt(data.systemPrompt);
      setAgentFirstMessage(data.firstMessage);
      setShowConversation(true);
    } catch (error) {
      console.error("Failed to start conversation:", error);
      setStartError(error instanceof Error ? error.message : "Failed to start conversation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseConversation = () => {
    setShowConversation(false);
    setAgentId(null);
    setAgentSystemPrompt(null);
    setAgentFirstMessage(null);
  };

  if (showConversation && agentId && agentSystemPrompt && agentFirstMessage) {
    return (
      <ConversationView
        mode={selectedMode}
        agentId={agentId}
        systemPrompt={agentSystemPrompt}
        firstMessage={agentFirstMessage}
        subjectCount={selectedSubjects.length}
        onClose={handleCloseConversation}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* LightRays background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <LightRays
          raysOrigin="top-center"
          raysColor={getModeColor(selectedMode)}
          // Reduce animation intensity when motion should be reduced
          raysSpeed={shouldReduceMotion ? 0.3 : 1.5}
          lightSpread={0.8}
          rayLength={1.2}
          // Disable mouse following for motion-sensitive users
          followMouse={!shouldReduceMotion}
          mouseInfluence={shouldReduceMotion ? 0 : 0.1}
          // Reduce/eliminate noise and distortion effects
          noiseAmount={shouldReduceMotion ? 0 : 0.1}
          distortion={shouldReduceMotion ? 0 : 0.05}
          className="w-full h-full"
        />
      </div>

      {/* Aurora background - positioned at bottom, on top of LightRays */}
      <div className="fixed bottom-0 left-0 right-0 h-1/2 overflow-hidden pointer-events-none z-[1] bg-transparent">
        <div className="w-full h-full rotate-180 bg-transparent">
          <Aurora
            colorStops={auroraColors}
            blend={0.5}
            // Reduce animation intensity when motion should be reduced
            amplitude={shouldReduceMotion ? 0.2 : 1.0}
            speed={shouldReduceMotion ? 0.1 : 0.5}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 pt-12 pb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-white blur-lg opacity-50" />
              <div className="relative p-3 rounded-xl bg-white">
                <img 
                  src="/assets/podu-logo.png" 
                  alt="PODU Logo" 
                  className="w-[60px] h-[60px] object-contain"
                />
              </div>
            </div>
            <div>
              <h1 className="font-display text-4xl font-extrabold tracking-tight">
                PODU
              </h1>
              <p className="font-mono text-xs text-muted-foreground -mt-1">
                Interactive Podcast
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UsageMeter />
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Main content - scrollable */}
      <main className="relative z-10 flex-1 overflow-y-auto scrollbar-hide px-6 pb-48">
        <div className="space-y-5 max-w-md mx-auto">
          {/* Subject selector */}
          <section>
            <SubjectSelector
              selected={selectedSubjects}
              onSelectionChange={setSelectedSubjects}
              maxSelections={3}
            />
          </section>

          {/* Mode selector */}
          <section>
            <ModeSelector
              selected={selectedMode}
              onSelect={setSelectedMode}
            />
          </section>
        </div>
      </main>

      {/* Fixed bottom play button */}
      <footer className="fixed bottom-0 inset-x-0 z-20">
        {/* Content */}
        <div className="relative px-6 py-8 pb-10">
          <div className="flex flex-col items-center gap-4">
            {/* Validation message */}
            {!canStart && (
              <p className="font-mono text-xs text-muted-foreground">
                Select at least one subject to start
              </p>
            )}
            
            {/* Error message */}
            {startError && (
              <div className="flex flex-col items-center gap-2 w-full max-w-md">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <p className="font-mono text-xs">{startError}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStart}
                  disabled={isLoading || !canStart}
                  className="font-mono text-xs"
                >
                  Retry
                </Button>
              </div>
            )}
            
            {/* Play button */}
            <PlayButton
              mode={selectedMode}
              isLoading={isLoading}
              disabled={!canStart}
              onClick={handleStart}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

