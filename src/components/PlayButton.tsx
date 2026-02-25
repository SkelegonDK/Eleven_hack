import { cn } from "@/lib/utils";
import { Play, Loader2, Mic } from "lucide-react";
import type { ConversationMode } from "./ModeSelector";

interface PlayButtonProps {
  mode: ConversationMode;
  isLoading?: boolean;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const modeStyles = {
  fun: {
    gradient: "from-pink-400 via-pink-500 to-rose-500",
    glow: "shadow-[0_0_60px_rgba(241,91,181,0.5)]",
    pulseColor: "bg-pink-500/30",
  },
  edu: {
    gradient: "from-sky-400 via-blue-500 to-blue-600",
    glow: "shadow-[0_0_60px_rgba(0,187,249,0.5)]",
    pulseColor: "bg-blue-500/30",
  },
  deep: {
    gradient: "from-purple-400 via-purple-500 to-violet-600",
    glow: "shadow-[0_0_60px_rgba(155,93,229,0.5)]",
    pulseColor: "bg-purple-500/30",
  },
};

export function PlayButton({ 
  mode, 
  isLoading = false, 
  isActive = false,
  disabled = false, 
  onClick 
}: PlayButtonProps) {
  const styles = modeStyles[mode];

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer ripple effects when active */}
      {isActive && (
        <>
          <div className={cn(
            "absolute w-40 h-40 rounded-full animate-ripple",
            styles.pulseColor
          )} />
          <div className={cn(
            "absolute w-40 h-40 rounded-full animate-ripple",
            styles.pulseColor,
            "[animation-delay:0.5s]"
          )} />
          <div className={cn(
            "absolute w-40 h-40 rounded-full animate-ripple",
            styles.pulseColor,
            "[animation-delay:1s]"
          )} />
        </>
      )}

      {/* Glow background */}
      <div className={cn(
        "absolute w-36 h-36 rounded-full blur-2xl transition-opacity duration-500",
        `bg-gradient-to-br ${styles.gradient}`,
        isActive ? "opacity-60" : "opacity-30"
      )} />

      {/* Main button */}
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        data-testid="play-button"
        aria-label={
          isLoading 
            ? "Connecting..." 
            : isActive 
            ? "End conversation" 
            : "Start conversation"
        }
        className={cn(
          "relative z-10",
          "w-32 h-32 rounded-full",
          "flex items-center justify-center",
          "bg-gradient-to-br",
          styles.gradient,
          "transition-all duration-300",
          "border-4 border-white/20",
          !disabled && !isLoading && styles.glow,
          !disabled && !isLoading && "hover:scale-105 active:scale-95",
          disabled && "opacity-50 cursor-not-allowed",
          isActive && "animate-pulse-glow"
        )}
      >
        {/* Inner highlight */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/30 to-transparent" />
        
        {/* Icon */}
        {isLoading ? (
          <Loader2 className="relative w-12 h-12 text-white animate-spin" />
        ) : isActive ? (
          <Mic className="relative w-12 h-12 text-white animate-pulse" />
        ) : (
          <Play className="relative w-12 h-12 text-white ml-1" />
        )}
      </button>

      {/* Status text */}
      <div className={cn(
        "absolute -bottom-8 left-1/2 -translate-x-1/2",
        "font-mono text-xs text-muted-foreground",
        "whitespace-nowrap"
      )}>
        {isLoading ? "Connecting..." : isActive ? "Tap to end" : "Tap to start"}
      </div>
    </div>
  );
}

