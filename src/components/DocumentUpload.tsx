import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Upload, File, X, Loader2, CheckCircle2 } from "lucide-react";

interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "success" | "error";
}

interface DocumentUploadProps {
  onDocumentsChange?: (documents: UploadedDocument[]) => void;
}

export function DocumentUpload({ onDocumentsChange }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);

    // Create initial document entries
    const newDocs: UploadedDocument[] = fileArray.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      status: "uploading" as const,
    }));

    setDocuments((prev) => {
      const updated = [...prev, ...newDocs];
      onDocumentsChange?.(updated);
      return updated;
    });

    // Upload each file to the server
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const doc = newDocs[i];

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const result = await response.json();

        setDocuments((prev) => {
          const updated = prev.map((d) =>
            d.id === doc.id ? { ...d, id: result.id, status: "success" as const } : d
          );
          onDocumentsChange?.(updated);
          return updated;
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        setDocuments((prev) => {
          const updated = prev.map((d) =>
            d.id === doc.id ? { ...d, status: "error" as const } : d
          );
          onDocumentsChange?.(updated);
          return updated;
        });
      }
    }
  };

  const removeDocument = async (id: string) => {
    // Remove from UI immediately
    setDocuments((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      onDocumentsChange?.(updated);
      return updated;
    });

    // Delete from server
    try {
      await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-border/50" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          or upload
        </span>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      {/* Upload zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative cursor-pointer",
          "flex flex-col items-center justify-center gap-2",
          "p-6 rounded-xl border-2 border-dashed",
          "transition-all duration-300",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.02]"
            : "border-border/50 bg-card/30 hover:border-border hover:bg-card/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.doc,.docx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className={cn(
          "p-3 rounded-full",
          "bg-gradient-to-br from-primary/20 to-accent/20",
          "transition-transform duration-300",
          isDragging && "scale-110"
        )}>
          <Upload className="w-6 h-6 text-primary" />
        </div>

        <div className="text-center">
          <p className="font-display font-medium text-sm text-foreground/90">
            Drop files or tap to upload
          </p>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            PDF, TXT, MD, DOC supported
          </p>
        </div>
      </div>

      {/* Uploaded files list */}
      {documents.length > 0 && (
        <div className="mt-3 space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg",
                "bg-card/50 border border-border/50"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-md",
                doc.status === "success"
                  ? "bg-green-500/20 text-green-500"
                  : doc.status === "error"
                  ? "bg-destructive/20 text-destructive"
                  : "bg-primary/20 text-primary"
              )}>
                {doc.status === "uploading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : doc.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <File className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-foreground truncate">
                  {doc.name}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {formatFileSize(doc.size)}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeDocument(doc.id);
                }}
                className={cn(
                  "p-1 rounded-md",
                  "text-muted-foreground hover:text-destructive",
                  "hover:bg-destructive/10 transition-colors"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
