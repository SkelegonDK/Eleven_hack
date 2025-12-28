import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { SubjectSelector } from "./SubjectSelector";
import { ModeSelector, type ConversationMode } from "./ModeSelector";
import { PlayButton } from "./PlayButton";
import { ConversationView } from "./ConversationView";
import { Button } from "./ui/button";
import { Headphones, AlertCircle } from "lucide-react";
import { SignedIn, UserButton } from "@clerk/clerk-react";
import LightRays from "./LightRays";
import Aurora from './Aurora';

const getModeColor = (mode: ConversationMode): string => {
  switch (mode) {
    case "fun":
      return "#ff8800"; // orange/amber
    case "edu":
      return "#00ffff"; // cyan
    case "deep":
      return "#aa00ff"; // violet/purple
    default:
      return "#00ffff"; // default to cyan
  }
};

// Map subject IDs to hex colors (using the "from" color from gradient)
const getSubjectColor = (subjectId: string): string => {
  const colorMap: Record<string, string> = {
    tech: "#06b6d4", // cyan-500
    science: "#22c55e", // green-500
    history: "#f59e0b", // amber-500
    philosophy: "#a855f7", // purple-500
    business: "#94a3b8", // slate-400
    health: "#f43f5e", // rose-500
    arts: "#d946ef", // fuchsia-500
    upload: "#6366f1", // indigo-500
  };
  return colorMap[subjectId] || "#3A29FF"; // default color
};

// Get Aurora colors based on selected subjects
const getAuroraColors = (selectedSubjects: string[]): string[] => {
  if (selectedSubjects.length === 0) {
    return ["#3A29FF", "#FF94B4", "#FF3232"]; // default colors
  }
  
  const colors = selectedSubjects.map(getSubjectColor);
  
  // Pad to 3 colors if needed
  while (colors.length < 3) {
    colors.push(colors[colors.length - 1] || "#3A29FF");
  }
  
  // Return only first 3 colors
  return colors.slice(0, 3);
};

export function LandingPage() {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<ConversationMode>("edu");
  const [isLoading, setIsLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);

  const canStart = selectedSubjects.length > 0;
  
  // Compute Aurora colors based on selected subjects
  const auroraColors = useMemo(() => getAuroraColors(selectedSubjects), [selectedSubjects]);

  const handleStart = async () => {
    if (!canStart) return;
    
    setStartError(null);
    setIsLoading(true);
    
    try {
      // Create or get an agent for this conversation
      const response = await fetch("/api/agents", {
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
  };

  if (showConversation && agentId) {
    return (
      <ConversationView
        mode={selectedMode}
        subjects={selectedSubjects}
        agentId={agentId}
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
          raysSpeed={1.5}
          lightSpread={0.8}
          rayLength={1.2}
          followMouse={true}
          mouseInfluence={0.1}
          noiseAmount={0.1}
          distortion={0.05}
          className="w-full h-full"
        />
      </div>

      {/* Aurora background - positioned at bottom, on top of LightRays */}
      <div className="fixed bottom-0 left-0 right-0 h-1/2 overflow-hidden pointer-events-none z-[1] bg-transparent">
        <div className="w-full h-full rotate-180 bg-transparent">
          <Aurora
            colorStops={auroraColors}
            blend={0.5}
            amplitude={1.0}
            speed={0.5}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 pt-12 pb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-accent blur-lg opacity-50" />
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary to-accent">
                <Headphones className="w-7 h-7 text-primary-foreground" />
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
          <div className="flex items-center gap-2">
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

