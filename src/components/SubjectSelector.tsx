import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Cpu, 
  Leaf, 
  BookOpen, 
  Brain, 
  TrendingUp, 
  Heart, 
  Palette,
  Pin,
  Check,
  Upload
} from "lucide-react";
import { UploadDialog } from "./UploadDialog";

export interface Subject {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
}

const subjects: Subject[] = [
  { id: "tech", name: "Technology & AI", icon: <Cpu className="w-5 h-5" />, color: "from-cyan-500 to-blue-600" },
  { id: "science", name: "Science & Nature", icon: <Leaf className="w-5 h-5" />, color: "from-green-500 to-emerald-600" },
  { id: "history", name: "History & Culture", icon: <BookOpen className="w-5 h-5" />, color: "from-amber-500 to-orange-600" },
  { id: "philosophy", name: "Philosophy & Ethics", icon: <Brain className="w-5 h-5" />, color: "from-purple-500 to-violet-600" },
  { id: "business", name: "Business", icon: <TrendingUp className="w-5 h-5" />, color: "from-slate-400 to-zinc-500" },
  { id: "health", name: "Health & Wellness", icon: <Heart className="w-5 h-5" />, color: "from-rose-500 to-pink-600" },
  { id: "arts", name: "Arts & Creativity", icon: <Palette className="w-5 h-5" />, color: "from-fuchsia-500 to-purple-600" },
];

interface SubjectSelectorProps {
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  maxSelections?: number;
}

export function SubjectSelector({ 
  selected, 
  onSelectionChange, 
  maxSelections = 3 
}: SubjectSelectorProps) {
  const [pinnedSubject, setPinnedSubject] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const toggleSubject = (subjectId: string) => {
    // Special handling for upload subject
    if (subjectId === "upload") {
      setIsUploadDialogOpen(true);
      return;
    }

    if (selected.includes(subjectId)) {
      // Deselect
      onSelectionChange(selected.filter(id => id !== subjectId));
      if (pinnedSubject === subjectId) {
        setPinnedSubject(null);
      }
    } else if (selected.length < maxSelections) {
      // Select
      onSelectionChange([...selected, subjectId]);
    }
  };

  const togglePin = (e: React.MouseEvent, subjectId: string) => {
    e.stopPropagation();
    if (pinnedSubject === subjectId) {
      setPinnedSubject(null);
    } else {
      setPinnedSubject(subjectId);
      // Ensure pinned subject is selected
      if (!selected.includes(subjectId)) {
        if (selected.length >= maxSelections) {
          // Replace last selected with pinned
          onSelectionChange([...selected.slice(0, -1), subjectId]);
        } else {
          onSelectionChange([...selected, subjectId]);
        }
      }
    }
  };

  // Sort subjects: pinned first, then selected, then rest
  const sortedSubjects = [...subjects].sort((a, b) => {
    if (a.id === pinnedSubject) return -1;
    if (b.id === pinnedSubject) return 1;
    const aSelected = selected.includes(a.id);
    const bSelected = selected.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  // Add upload subject at the end
  const uploadSubject: Subject = {
    id: "upload",
    name: "Upload Document",
    icon: <Upload className="w-5 h-5" />,
    color: "from-indigo-500 to-purple-600",
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg text-foreground/90">Subjects</h2>
        <span className="text-xs font-mono text-muted-foreground">
          {selected.length}/{maxSelections} selected
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2.5">
        {sortedSubjects.map((subject) => {
          const isSelected = selected.includes(subject.id);
          const isPinned = pinnedSubject === subject.id;
          const isDisabled = !isSelected && selected.length >= maxSelections;
          
          return (
            <button
              key={subject.id}
              onClick={() => !isDisabled && toggleSubject(subject.id)}
              disabled={isDisabled}
              className={cn(
                "relative group flex items-center gap-2.5 p-3 rounded-xl",
                "border-2 transition-all duration-300",
                "font-display text-sm font-medium text-left",
                isSelected 
                  ? "border-primary/60 bg-primary/10" 
                  : "border-border/50 bg-card/50 hover:border-border hover:bg-card/80",
                isDisabled && "opacity-40 cursor-not-allowed",
                isPinned && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
              )}
            >
              {/* Gradient background on selection */}
              {isSelected && (
                <div className={cn(
                  "absolute inset-0 rounded-xl opacity-20 bg-gradient-to-br",
                  subject.color
                )} />
              )}
              
              {/* Icon */}
              <div className={cn(
                "relative flex-shrink-0 p-2 rounded-lg bg-gradient-to-br",
                subject.color,
                "text-white shadow-lg"
              )}>
                {subject.icon}
              </div>
              
              {/* Name */}
              <span className="relative flex-1 truncate">{subject.name}</span>
              
              {/* Selection indicator */}
              {isSelected && (
                <div className="relative flex-shrink-0">
                  <Check className="w-4 h-4 text-primary" />
                </div>
              )}
              
              {/* Pin button */}
              {isSelected && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(e as any, subject.id);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className={cn(
                    "absolute -top-1.5 -right-1.5 p-1 rounded-full cursor-pointer",
                    "bg-background border border-border shadow-md",
                    "transition-all duration-200",
                    isPinned 
                      ? "text-primary rotate-45" 
                      : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                  )}
                  role="button"
                  tabIndex={0}
                  aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${subject.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      togglePin(e as any, subject.id);
                    }
                  }}
                >
                  <Pin className="w-3 h-3" />
                </div>
              )}
            </button>
          );
        })}
        
        {/* Upload Document button */}
        <button
          onClick={() => toggleSubject(uploadSubject.id)}
          className={cn(
            "relative group flex items-center gap-2.5 p-3 rounded-xl",
            "border-2 transition-all duration-300",
            "font-display text-sm font-medium text-left",
            "border-border/50 bg-card/50 hover:border-border hover:bg-card/80"
          )}
        >
          {/* Icon */}
          <div className={cn(
            "relative flex-shrink-0 p-2 rounded-lg bg-gradient-to-br",
            uploadSubject.color,
            "text-white shadow-lg"
          )}>
            {uploadSubject.icon}
          </div>
          
          {/* Name */}
          <span className="relative flex-1 truncate">{uploadSubject.name}</span>
        </button>
      </div>
      
      {pinnedSubject && (
        <p className="mt-2 text-xs text-muted-foreground font-mono">
          Pinned topic will be the main focus of the conversation
        </p>
      )}

      <UploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
      />
    </div>
  );
}

export { subjects };

