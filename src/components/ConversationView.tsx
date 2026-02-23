import { useState, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { cn } from "@/lib/utils";
import { PlayButton } from "./PlayButton";
import type { ConversationMode } from "./ModeSelector";
import { subjects as allSubjects } from "./SubjectSelector";
import { AGENT_PROMPTS } from "../api/agentPrompts";
import { X, Volume2, VolumeX, Mic, MicOff } from "lucide-react";

interface ConversationViewProps {
  mode: ConversationMode;
  subjects: string[];
  agentId: string;
  onClose: () => void;
}

const modeStyles = {
  fun: {
    gradient: "from-amber-400/20 via-orange-500/20 to-red-500/20",
    border: "border-orange-500/30",
    text: "text-orange-400",
    bg: "bg-orange-500",
  },
  edu: {
    gradient: "from-cyan-400/20 via-teal-500/20 to-emerald-500/20",
    border: "border-teal-500/30",
    text: "text-teal-400",
    bg: "bg-teal-500",
  },
  deep: {
    gradient: "from-violet-400/20 via-purple-500/20 to-indigo-600/20",
    border: "border-violet-500/30",
    text: "text-violet-400",
    bg: "bg-violet-500",
  },
};

const modeNames = {
  fun: "FUN",
  edu: "EDU",
  deep: "DEEP",
};

export function ConversationView({ 
  mode, 
  subjects, 
  agentId,
  onClose 
}: ConversationViewProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const styles = modeStyles[mode];

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs");
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs");
    },
    onMessage: (message) => {
      console.log("Message:", message);
    },
    onError: (error) => {
      console.error("Conversation error:", error);
    },
  });

  const { status, isSpeaking } = conversation;

  const startConversation = useCallback(async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Build topic restriction from selected subjects
      const selectedSubjectNames = allSubjects
        .filter(s => subjects.includes(s.id))
        .map(s => s.name);

      const topicSection = selectedSubjectNames.length > 0
        ? `\n\nTOPIC FOCUS (NON-NEGOTIABLE):\nThe user has selected these specific topics: ${selectedSubjectNames.join(", ")}.\n- Discuss ONLY these topics.\n- Do NOT bring up artificial intelligence, machine learning, or any subject not in the list above, even tangentially.\n- If the conversation drifts off-topic, steer it back to the selected topics.`
        : "";

      // Start the conversation with the agent
      await conversation.startSession({
        agentId: agentId,
        connectionType: "webrtc",
        overrides: {
          agent: {
            prompt: {
              prompt: AGENT_PROMPTS[mode].systemPrompt + topicSection,
            },
            firstMessage: AGENT_PROMPTS[mode].firstMessage,
          },
        },
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  }, [conversation, agentId, mode, subjects]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const toggleConversation = () => {
    if (status === "connected") {
      stopConversation();
    } else {
      startConversation();
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setVolume(newMuted ? 0 : 1);
    conversation.setVolume({ volume: newMuted ? 0 : 1 });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (status === "connected") {
        conversation.endSession();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Animated background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-50",
        styles.gradient
      )} />
      
      {/* Animated circles background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "absolute rounded-full blur-3xl opacity-20",
              styles.bg,
              "animate-float"
            )}
            style={{
              width: `${150 + i * 50}px`,
              height: `${150 + i * 50}px`,
              left: `${10 + i * 20}%`,
              top: `${20 + i * 15}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${6 + i}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div 
            data-testid="conversation-mode-badge"
            className={cn(
            "px-3 py-1 rounded-full text-xs font-bold font-mono",
            styles.bg,
            "text-white"
          )}>
            {modeNames[mode]}
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {subjects.length} topic{subjects.length > 1 ? "s" : ""}
          </span>
        </div>

        <button
          onClick={onClose}
          className={cn(
            "p-2 rounded-full",
            "bg-card/50 border border-border/50",
            "hover:bg-card transition-colors"
          )}
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        {/* Status indicator */}
        <div className={cn(
          "mb-8 px-4 py-2 rounded-full",
          "bg-card/50 backdrop-blur border",
          styles.border
        )}>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              status === "connected" 
                ? isSpeaking 
                  ? "bg-green-500 animate-pulse" 
                  : "bg-green-500"
                : status === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : "bg-muted-foreground"
            )} />
            <span className="font-mono text-xs text-foreground/80">
              {status === "connected" 
                ? isSpeaking 
                  ? "Host is speaking..." 
                  : "Listening..."
                : status === "connecting"
                ? "Connecting..."
                : "Ready to start"
              }
            </span>
          </div>
        </div>

        {/* Play button */}
        <PlayButton
          mode={mode}
          isLoading={status === "connecting"}
          isActive={status === "connected"}
          onClick={toggleConversation}
        />

        {/* Audio visualizer placeholder */}
        {status === "connected" && (
          <div className="mt-16 flex items-end justify-center gap-1 h-12">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 rounded-full transition-all duration-150",
                  styles.bg
                )}
                style={{
                  height: isSpeaking 
                    ? `${Math.random() * 100}%` 
                    : "20%",
                  opacity: isSpeaking ? 0.8 : 0.3,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer controls */}
      <footer className="relative z-10 p-6 pb-10">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={cn(
              "p-3 rounded-full",
              "bg-card/50 backdrop-blur border border-border/50",
              "hover:bg-card transition-colors"
            )}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>

          <div className={cn(
            "px-4 py-2 rounded-full",
            "bg-card/50 backdrop-blur border border-border/50",
            "font-mono text-xs text-muted-foreground"
          )}>
            {status === "connected" ? (
              <span className="flex items-center gap-2">
                <Mic className="w-3 h-3" />
                Live
              </span>
            ) : (
              "Tap play to begin"
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

