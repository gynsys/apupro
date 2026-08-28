import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ScrapingConfig } from '../hooks/useScrapingApi';

interface ScrapingDashboardContextType {
  config: ScrapingConfig;
  setConfig: (config: ScrapingConfig) => void;
  isConfigDirty: boolean;
  setIsConfigDirty: (dirty: boolean) => void;
  autoScrollEnabled: boolean;
  setAutoScrollEnabled: (enabled: boolean) => void;
}

const ScrapingDashboardContext = createContext<ScrapingDashboardContextType | undefined>(undefined);

export const ScrapingDashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ScrapingConfig>({
    max_concurrency: 25,
    headless: true,
    bypass_cloudflare: true,
    request_delay_ms: 20000,
    active_portals: ['mercadolibre', 'epa'],
    batch_size: 10
  });
  
  const [isConfigDirty, setIsConfigDirty] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const handleSetConfig = useCallback((newConfig: ScrapingConfig) => {
    setConfig(newConfig);
    setIsConfigDirty(true);
  }, []);

  return (
    <ScrapingDashboardContext.Provider
      value={{
        config,
        setConfig: handleSetConfig,
        isConfigDirty,
        setIsConfigDirty,
        autoScrollEnabled,
        setAutoScrollEnabled
      }}
    >
      {children}
    </ScrapingDashboardContext.Provider>
  );
};

export const useScrapingDashboard = () => {
  const context = useContext(ScrapingDashboardContext);
  if (context === undefined) {
    throw new Error('useScrapingDashboard must be used within a ScrapingDashboardProvider');
  }
  return context;
};