import React, { useEffect, useRef, useState } from "react";
import { Terminal, Filter, Trash2 } from "lucide-react";
import { BadgeToggle } from "../ui/BadgeToggle";
import { useScrapingWebSocket } from "../../hooks/useScrapingWebSocket";

type LogLevel = "INFO" | "WARN" | "ERROR";

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface LogConsoleProps {
  className?: string;
}

export const LogConsole: React.FC<LogConsoleProps> = ({ className }) => {
  const { logs, connected } = useScrapingWebSocket();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<Set<LogLevel>>(
    new Set(["INFO", "WARN", "ERROR"])
  );

  /* Auto-scroll al recibir nuevos logs */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const toggleFilter = (level: LogLevel) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const filtered = logs.filter((l) => filters.has(l.level));

  const levelMeta: Record<
    LogLevel,
    { text: string; activeClass: string }
  > = {
    INFO: {
      text: "text-emerald-400",
      activeClass:
        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    WARN: {
      text: "text-amber-400",
      activeClass:
        "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    ERROR: {
      text: "text-red-400",
      activeClass:
        "bg-red-500/10 text-red-400 border-red-500/20",
    },
  };

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-300">
            System Logs
          </span>
          <span className="text-[10px] tabular-nums text-zinc-600">
            {filtered.length} / {logs.length}
          </span>
          <span className={`text-[10px] ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
            {connected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-zinc-600" />
            {(["INFO", "WARN", "ERROR"] as LogLevel[]).map((lvl) => (
              <BadgeToggle
                key={lvl}
                active={filters.has(lvl)}
                className={levelMeta[lvl].activeClass}
                onClick={() => toggleFilter(lvl)}
              >
                {lvl}
              </BadgeToggle>
            ))}
          </div>
        </div>
      </div>

      {/* Console Body */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5">
        {filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-zinc-700">
            <span className="italic">Waiting for logs...</span>
          </div>
        ) : (
          filtered.map((log) => (
            <div key={log.id} className="flex gap-2.5">
              <span className="shrink-0 tabular-nums text-zinc-600">
                {log.timestamp}
              </span>
              <span
                className={`shrink-0 font-bold ${levelMeta[log.level].text}`}
              >
                [{log.level}]
              </span>
              <span className="break-all text-zinc-300">{log.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};