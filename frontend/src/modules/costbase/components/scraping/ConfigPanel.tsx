import React from "react";
import { Settings, Gauge, Eye, ShieldCheck, Timer, Globe, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Label, Input } from "../ui/Input";
import { Switch } from "../ui/Switch";
import { useScrapingDashboard } from "../../context/ScrapingDashboardContext";
import { useScrapingApi } from "../../hooks/useScrapingApi";

export const ConfigPanel: React.FC<{ className?: string }> = ({ className }) => {
  const { config, setConfig, isConfigDirty, setIsConfigDirty } = useScrapingDashboard();
  const { updateConfig, loading } = useScrapingApi();

  const handleConfigChange = async (patch: Partial<typeof config>) => {
    const newConfig = { ...config, ...patch };
    setConfig(newConfig);
  };

  const handleSaveConfig = async () => {
    try {
      await updateConfig(config);
      setIsConfigDirty(false);
    } catch (error) {
      console.error("Error saving config:", error);
    }
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-zinc-400" />
            <CardTitle>Configuration</CardTitle>
          </div>
          {isConfigDirty && (
            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Max Concurrency Slider */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-zinc-300">
              <Gauge className="h-3.5 w-3.5 text-zinc-500" />
              Max Concurrency
            </Label>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] font-mono font-medium text-zinc-300">
              {config.max_concurrency.toString().padStart(2, "0")} / 50
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={config.max_concurrency}
            onChange={(e) =>
              handleConfigChange({ max_concurrency: Number(e.target.value) })
            }
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-emerald-500 outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
          <div className="flex justify-between text-[10px] font-medium text-zinc-600">
            <span>1 thread</span>
            <span>50 threads</span>
          </div>
        </div>

        {/* Switches */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="headless"
              className="flex cursor-pointer items-center gap-1.5 text-zinc-300"
            >
              <Eye className="h-3.5 w-3.5 text-zinc-500" />
              Headless Mode
            </Label>
            <Switch
              id="headless"
              checked={config.headless}
              onChange={(e) =>
                handleConfigChange({ headless: e.target.checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label
              htmlFor="bypass"
              className="flex cursor-pointer items-center gap-1.5 text-zinc-300"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" />
              Bypass Cloudflare
            </Label>
            <Switch
              id="bypass"
              checked={config.bypass_cloudflare}
              onChange={(e) =>
                handleConfigChange({ bypass_cloudflare: e.target.checked })
              }
            />
          </div>
        </div>

        {/* Request Delay */}
        <div className="space-y-2">
          <Label
            htmlFor="delay"
            className="flex items-center gap-1.5 text-zinc-300"
          >
            <Timer className="h-3.5 w-3.5 text-zinc-500" />
            Request Delay
          </Label>
          <div className="relative">
            <Input
              id="delay"
              type="number"
              min={0}
              max={10000}
              step={100}
              value={config.request_delay_ms}
              onChange={(e) =>
                handleConfigChange({ request_delay_ms: Number(e.target.value) })
              }
              className="pr-10 font-mono tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-zinc-600">
              ms
            </span>
          </div>
        </div>

        {/* Batch Size */}
        <div className="space-y-2">
          <Label
            htmlFor="batch"
            className="flex items-center gap-1.5 text-zinc-300"
          >
            <Gauge className="h-3.5 w-3.5 text-zinc-500" />
            Batch Size
          </Label>
          <Input
            id="batch"
            type="number"
            min={1}
            max={100}
            value={config.batch_size}
            onChange={(e) =>
              handleConfigChange({ batch_size: Number(e.target.value) })
            }
            className="font-mono tabular-nums"
          />
        </div>

        {/* Portal URLs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-zinc-300">
              <Globe className="h-3.5 w-3.5 text-zinc-500" />
              Portal URLs
            </Label>
            <button
              onClick={() => {
                const newPortalName = `portal_${Object.keys(config.portal_urls).length + 1}`;
                handleConfigChange({
                  portal_urls: { ...config.portal_urls, [newPortalName]: 'https://example.com/{query}' }
                });
              }}
              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Agregar
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(config.portal_urls).map(([portalName, url]) => (
              <div key={portalName} className="space-y-1 p-2 rounded bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="checkbox"
                      id={`portal-${portalName}`}
                      checked={config.active_portals.includes(portalName)}
                      onChange={(e) => {
                        const newActivePortals = e.target.checked
                          ? [...config.active_portals, portalName]
                          : config.active_portals.filter(p => p !== portalName);
                        handleConfigChange({ active_portals: newActivePortals });
                      }}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                    />
                    <Input
                      type="text"
                      value={portalName}
                      onChange={(e) => {
                        const newPortalUrls = { ...config.portal_urls };
                        delete newPortalUrls[portalName];
                        newPortalUrls[e.target.value] = url;
                        const newActivePortals = config.active_portals.map(p =>
                          p === portalName ? e.target.value : p
                        );
                        handleConfigChange({
                          portal_urls: newPortalUrls,
                          active_portals: newActivePortals
                        });
                      }}
                      className="text-xs font-mono w-32 h-7"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const newPortalUrls = { ...config.portal_urls };
                      delete newPortalUrls[portalName];
                      const newActivePortals = config.active_portals.filter(p => p !== portalName);
                      handleConfigChange({
                        portal_urls: newPortalUrls,
                        active_portals: newActivePortals
                      });
                    }}
                    className="text-zinc-500 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  type="text"
                  value={url}
                  onChange={(e) =>
                    handleConfigChange({
                      portal_urls: { ...config.portal_urls, [portalName]: e.target.value }
                    })
                  }
                  placeholder="https://example.com/{query}"
                  className="text-xs font-mono h-7"
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};