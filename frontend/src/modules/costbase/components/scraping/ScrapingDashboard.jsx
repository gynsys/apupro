import React, { useState, useEffect } from 'react';
import { ControlBar } from './ControlBar';
import { LogConsole } from './LogConsole';
import { ConfigPanel } from './ConfigPanel';
import { useScrapingApi } from '../../hooks/useScrapingApi';

const ScrapingDashboard = () => {
  const [botStatus, setBotStatus] = useState('idle');
  const { getStatus } = useScrapingApi();

  useEffect(() => {
    let isMounted = true;

    const syncStatus = async () => {
      try {
        const res = await getStatus();
        if (isMounted && res && res.status) {
          setBotStatus(res.status);
        }
      } catch (err) {
        // Silencioso si la red está ocupada
      }
    };

    syncStatus();
    const timer = setInterval(syncStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 overflow-y-auto pr-1">
      <ControlBar status={botStatus} onStatusChange={setBotStatus} className="shrink-0 rounded-xl" />
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[520px] min-w-0 pb-4">
        <div className="flex-1 min-h-[380px] flex flex-col min-w-0">
          <LogConsole className="flex-1 min-h-0 h-full" />
        </div>
        <div className="w-full lg:w-96 flex flex-col min-h-0 max-h-[750px] shrink-0">
          <ConfigPanel className="flex-1 min-h-0 overflow-hidden" />
        </div>
      </div>
    </div>
  );
};

export default ScrapingDashboard;

