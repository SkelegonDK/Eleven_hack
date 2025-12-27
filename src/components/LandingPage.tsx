import { useState } from "react";
import { cn } from "@/lib/utils";
import { SubjectSelector } from "./SubjectSelector";
import { ModeSelector, type ConversationMode } from "./ModeSelector";
import { PlayButton } from "./PlayButton";
import { ConversationView } from "./ConversationView";
import { Button } from "./ui/button";
import { Headphones, AlertCircle } from "lucide-react";
import { SignedIn, UserButton } from "@clerk/clerk-react";

export function LandingPage() {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<ConversationMode>("edu");
  const [isLoading, setIsLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);

  const canStart = selectedSubjects.length > 0;

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
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
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
        {/* Gradient fade */}
        <div className="absolute inset-x-0 -top-20 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        
        {/* Content */}
        <div className="relative bg-background/80 backdrop-blur-xl px-6 py-8 pb-10">
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

