import { cn } from "@/lib/utils";
import { Sparkles, GraduationCap, Waves } from "lucide-react";

export type ConversationMode = "fun" | "edu" | "deep";

interface ModeSelectorProps {
  selected: ConversationMode;
  onSelect: (mode: ConversationMode) => void;
}

const modes = [
  {
    id: "fun" as const,
    name: "FUN",
    description: "Sarcastic & cheeky",
    icon: Sparkles,
    gradient: "from-pink-400 via-pink-500 to-rose-500",
    glow: "glow-fun",
    textGradient: "text-gradient-fun",
    bgColor: "bg-fun/20",
    borderColor: "border-fun/50",
    activeColor: "bg-fun text-fun-foreground",
  },
  {
    id: "edu" as const,
    name: "EDU",
    description: "Friendly & clear",
    icon: GraduationCap,
    gradient: "from-sky-400 via-blue-500 to-blue-600",
    glow: "glow-edu",
    textGradient: "text-gradient-edu",
    bgColor: "bg-edu/20",
    borderColor: "border-edu/50",
    activeColor: "bg-edu text-edu-foreground",
  },
  {
    id: "deep" as const,
    name: "DEEP",
    description: "Profound & emotional",
    icon: Waves,
    gradient: "from-purple-400 via-purple-500 to-violet-600",
    glow: "glow-deep",
    textGradient: "text-gradient-deep",
    bgColor: "bg-deep/20",
    borderColor: "border-deep/50",
    activeColor: "bg-deep text-deep-foreground",
  },
];

export function ModeSelector({ selected, onSelect }: ModeSelectorProps) {
  return (
    <div className="w-full">
      <h2 className="font-display font-bold text-lg text-foreground/90 mb-3">Mode</h2>
      
      <div className="flex gap-2">
        {modes.map((mode) => {
          const isActive = selected === mode.id;
          const Icon = mode.icon;
          
          return (
            <button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              className={cn(
                "flex-1 relative group overflow-hidden",
                "flex flex-col items-center justify-center gap-1",
                "py-3 px-2 rounded-2xl",
                "border-2 transition-all duration-300",
                "font-display font-bold",
                isActive
                  ? cn(mode.activeColor, mode.borderColor, mode.glow)
                  : cn("bg-card/50 border-border/50 hover:border-border hover:bg-card/80")
              )}
            >
              {/* Animated gradient background when active */}
              {isActive && (
                <div 
                  className={cn(
                    "absolute inset-0 opacity-30 bg-gradient-to-br",
                    mode.gradient
                  )}
                />
              )}
              
              {/* Icon */}
              <Icon className={cn(
                "relative w-5 h-5 transition-transform duration-300",
                isActive ? "scale-110" : "group-hover:scale-105"
              )} />
              
              {/* Mode name */}
              <span className={cn(
                "relative text-sm tracking-wider",
                isActive ? "" : mode.textGradient
              )}>
                {mode.name}
              </span>
              
              {/* Description - only show when active */}
              {isActive && (
                <span className="relative text-[10px] font-normal opacity-80 font-mono">
                  {mode.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { modes };

