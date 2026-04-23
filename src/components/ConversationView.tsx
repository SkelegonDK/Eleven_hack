import { useState, useEffect, useCallback, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { cn } from "@/lib/utils";
import { PlayButton } from "./PlayButton";
import type { ConversationMode } from "./ModeSelector";
import { X, Volume2, VolumeX, Mic, AlertCircle } from "lucide-react";

interface ConversationViewProps {
  mode: ConversationMode;
  agentId: string;
  systemPrompt: string;
  firstMessage: string;
  subjectCount: number;
  onClose: () => void;
}

const modeStyles = {
  fun: {
    gradient: "from-pink-400/20 via-pink-500/20 to-rose-500/20",
    border: "border-pink-500/30",
    text: "text-pink-400",
    bg: "bg-pink-500",
  },
  edu: {
    gradient: "from-sky-400/20 via-blue-500/20 to-blue-600/20",
    border: "border-blue-500/30",
    text: "text-blue-400",
    bg: "bg-blue-500",
  },
  deep: {
    gradient: "from-purple-400/20 via-purple-500/20 to-violet-600/20",
    border: "border-purple-500/30",
    text: "text-purple-400",
    bg: "bg-purple-500",
  },
};

const modeNames = {
  fun: "FUN",
  edu: "EDU",
  deep: "DEEP",
};

export function ConversationView({
  mode,
  agentId,
  systemPrompt,
  firstMessage,
  subjectCount,
  onClose,
}: ConversationViewProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [startError, setStartError] = useState<string | null>(null);
  const styles = modeStyles[mode];
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setStartError(null);
    },
    onDisconnect: () => {},
    onMessage: () => {},
    onError: (error: unknown) => {
      const message = typeof error === "object" && error !== null && "message" in error && typeof (error as Error).message === "string"
        ? (error as Error).message
        : "Connection error. Please try again.";
      setStartError(message);
    },
  });

  // Keep ref in sync for cleanup
  conversationRef.current = conversation;

  const { status, isSpeaking } = conversation;

  const startConversation = useCallback(async () => {
    setStartError(null);
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Fetch conversation token for WebRTC
      const tokenRes = await fetch(`/api/agents/${agentId}/conversation-token`);
      if (!tokenRes.ok) {
        const errorData = await tokenRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get conversation token");
      }
      const { token } = (await tokenRes.json()) as { token: string };

      // Start the conversation with server-built prompt
      await conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
        overrides: {
          agent: {
            prompt: {
              prompt: systemPrompt,
            },
            firstMessage,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start conversation";
      setStartError(message);
    }
  }, [conversation, agentId, systemPrompt, firstMessage]);

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

  // Cleanup on unmount using ref to avoid stale closure
  useEffect(() => {
    return () => {
      conversationRef.current?.endSession();
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
            {subjectCount} topic{subjectCount > 1 ? "s" : ""}
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
        {/* Error banner */}
        {startError && (
          <div
            role="alert"
            className={cn(
              "mb-6 flex items-center gap-3 px-4 py-3 rounded-lg max-w-md w-full",
              "bg-destructive/10 border border-destructive/30 text-destructive"
            )}
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="font-mono text-sm">{startError}</p>
            <button
              onClick={() => setStartError(null)}
              className="ml-auto p-1 rounded hover:bg-destructive/20 transition-colors"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
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
