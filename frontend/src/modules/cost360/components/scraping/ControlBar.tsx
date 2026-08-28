import React from "react";
import { Play, Pause, ShieldAlert, Activity } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useScrapingApi } from "../../hooks/useScrapingApi";

type BotStatus = "idle" | "running" | "paused" | "error";

interface ControlBarProps {
  status: BotStatus;
  onStatusChange: (status: BotStatus) => void;
  className?: string;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  status,
  onStatusChange,
  className,
}) => {
  const { startScraping, pauseScraping, resumeScraping, killScraping, loading } = useScrapingApi();

  const handleStart = async () => {
    try {
      await startScraping();
      onStatusChange("running");
    } catch (error) {
      console.error("Error starting scraping:", error);
    }
  };

  const handlePause = async () => {
    try {
      await pauseScraping();
      onStatusChange("paused");
    } catch (error) {
      console.error("Error pausing scraping:", error);
    }
  };

  const handleResume = async () => {
    try {
      await resumeScraping();
      onStatusChange("running");
    } catch (error) {
      console.error("Error resuming scraping:", error);
    }
  };

  const handleKill = async () => {
    try {
      await killScraping();
      onStatusChange("idle");
    } catch (error) {
      console.error("Error killing scraping:", error);
    }
  };

  const statusConfig = {
    idle: {
      label: "Idle",
      style: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    },
    running: {
      label: "Running",
      style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      indicator: true,
    },
    paused: {
      label: "Paused",
      style: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    error: {
      label: "Error",
      style: "bg-red-500/10 text-red-400 border-red-500/20",
    },
  };

  const current = statusConfig[status];

  return (
    <div
      className={`flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-5 py-3 backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center gap-4">
        <h1 className="text-base font-semibold tracking-tight text-zinc-100">
          Scraping Bot
        </h1>

        <Badge className={`gap-1.5 border ${current.style}`}>
          {"indicator" in current && current.indicator && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
          )}
          {!current.indicator && <Activity className="h-3 w-3" />}
          {current.label}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="default"
          onClick={status === "paused" ? handleResume : handleStart}
          disabled={status === "running" || loading}
          className="gap-2"
        >
          <Play className="h-4 w-4 fill-current" />
          {status === "paused" ? "Reanudar" : "Iniciar"}
        </Button>

        <Button
          variant="outline"
          onClick={handlePause}
          disabled={status !== "running" || loading}
          className="gap-2"
        >
          <Pause className="h-4 w-4 fill-current" />
          Pausar
        </Button>

        <Button
          variant="destructive"
          onClick={handleKill}
          disabled={status === "idle" || loading}
          className="gap-2 animate-pulse"
        >
          <ShieldAlert className="h-4 w-4" />
          Kill Switch
        </Button>
      </div>
    </div>
  );
};