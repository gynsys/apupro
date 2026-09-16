import React, { useState } from "react";
import { Play, Pause, ShieldAlert, Activity, Download } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useScrapingApi } from "../../hooks/useScrapingApi";
import { API_URL } from "../../../../services/api";

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

  const [downloading, setDownloading] = useState(false);

  const handleKill = async () => {
    try {
      await killScraping();
      onStatusChange("idle");
    } catch (error) {
      console.error("Error killing scraping:", error);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const token = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('arko_admin_token') || localStorage.getItem('token'))
        : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${API_URL}/scraping/export-excel`, {
        headers,
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('No hay datos en el historial para exportar a Excel');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `precios_scraped_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al descargar Excel');
    } finally {
      setDownloading(false);
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
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
        >
          <Play className="h-4 w-4 fill-current" />
          {status === "paused" ? "Reanudar" : "Iniciar Scraping"}
        </Button>

        <Button
          variant="outline"
          onClick={handlePause}
          disabled={status !== "running" || loading}
          className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <Pause className="h-4 w-4 fill-current" />
          Pausar
        </Button>

        <Button
          variant="destructive"
          onClick={handleKill}
          disabled={loading}
          className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-sm"
          title="Detener inmediatamente el proceso de scraping"
        >
          <ShieldAlert className="h-4 w-4" />
          Detener Bot
        </Button>

        <Button
          variant="outline"
          onClick={handleDownloadExcel}
          disabled={downloading}
          className="gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Descargando..." : "Descargar Excel"}
        </Button>
      </div>
    </div>
  );
};