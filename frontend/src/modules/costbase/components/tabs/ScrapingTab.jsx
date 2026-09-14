import React from 'react';
import { ScrapingDashboardProvider } from '../../context/ScrapingDashboardContext';
import ScrapingDashboard from '../scraping/ScrapingDashboard';

const ScrapingTab = () => {
  return (
    <ScrapingDashboardProvider>
      <ScrapingDashboard />
    </ScrapingDashboardProvider>
  );
};

export default ScrapingTab;
