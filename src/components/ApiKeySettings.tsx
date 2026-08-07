import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { failureCopy } from "@/lib/failureCopy";

export interface ConfigStatus {
  hasApiKey: boolean;
  apiKeySource: "session" | "env" | "none";
  apiKeyPreview: string | null;
  agentIds: { fun: boolean; edu: boolean; deep: boolean };
  missingAgentModes: ("fun" | "edu" | "deep")[];
}

interface ApiKeySettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: ConfigStatus | null;
  onSaved: (status: ConfigStatus) => void;
  /** When true, the dialog cannot be dismissed (first-run / blocker mode). */
  blocking?: boolean;
}

export function ApiKeySettings({
  open,
  onOpenChange,
  status,
  onSaved,
  blocking = false,
}: ApiKeySettingsProps) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setApiKey("");
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const refreshStatus = useCallback(async (): Promise<ConfigStatus | null> => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) return null;
      return (await res.json()) as ConfigStatus;
    } catch {
      return null;
    }
  }, []);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("Paste your ElevenLabs API key to save.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Request failed with status ${res.status}`);
        return;
      }
      setSuccess("API key verified and saved.");
      setApiKey("");
      const next = await refreshStatus();
      if (next) onSaved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setError(null);
    setSuccess(null);
    setClearing(true);
    try {
      const res = await fetch("/api/config", { method: "DELETE" });
      if (!res.ok) {
        setError(`Failed to clear key (HTTP ${res.status})`);
        return;
      }
      const next = await refreshStatus();
      if (next) onSaved(next);
      setSuccess("API key removed from this session.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear key.");
    } finally {
      setClearing(false);
    }
  };

  const missingAgents = status?.missingAgentModes ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (blocking && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={!blocking}
        onEscapeKeyDown={(e) => {
          if (blocking) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (blocking) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (blocking) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            ElevenLabs API connection
          </DialogTitle>
          <DialogDescription>
            PODU calls ElevenLabs on your behalf. Your key is sealed in an httpOnly
            cookie — it never reaches the browser bundle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <StatusRow
            label="API key"
            value={
              status?.hasApiKey
                ? `${status.apiKeyPreview ?? "configured"} ${
                    status.apiKeySource === "env" ? "(from .env)" : "(from session)"
                  }`
                : "Not configured"
            }
            ok={!!status?.hasApiKey}
          />

          <div>
            <Label htmlFor="elevenlabs-api-key" className="text-xs font-mono">
              {status?.hasApiKey ? "Replace key" : "Paste your ElevenLabs API key"}
            </Label>
            <Input
              id="elevenlabs-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={saving || clearing}
              className="mt-1 font-mono"
            />
            <p className="mt-1 text-[11px] font-mono text-muted-foreground">
              Generate one under Profile → API Keys in the ElevenLabs dashboard.
            </p>
          </div>

          {missingAgents.length > 0 && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3",
                "text-amber-500",
              )}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="text-[11px] font-mono leading-relaxed">
                {failureCopy("missing_agent_id", "setup", { modes: missingAgents }).message}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-mono leading-relaxed">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-500">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-mono leading-relaxed">{success}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {status?.hasApiKey && status.apiKeySource === "session" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={saving || clearing}
              className="text-xs font-mono"
            >
              {clearing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Remove stored key
            </Button>
          ) : (
            <span />
          )}

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || clearing || !apiKey.trim()}
            className="font-mono text-xs"
          >
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Verifying…
              </>
            ) : (
              "Verify & save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 px-3 py-2">
      <span className="text-xs font-mono text-muted-foreground">{label}</span>
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs font-mono",
          ok ? "text-emerald-500" : "text-destructive",
        )}
      >
        {ok ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5" />
        )}
        {value}
      </span>
    </div>
  );
}
