import React, { useState } from 'react';
import { ControlBar } from './ControlBar';
import { LogConsole } from './LogConsole';
import { ConfigPanel } from './ConfigPanel';

const ScrapingDashboard = () => {
  const [botStatus, setBotStatus] = useState('idle');

  return (
    <div className="flex flex-col gap-4 h-full">
      <ControlBar status={botStatus} onStatusChange={setBotStatus} />
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1">
          <LogConsole />
        </div>
        <div className="w-80">
          <ConfigPanel />
        </div>
      </div>
    </div>
  );
};

export default ScrapingDashboard;
