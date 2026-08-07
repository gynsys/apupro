import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid, Layers, Container, Calculator, ArrowLeft, Zap, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cmsData } from '../data/cmsData.js';
import DropCeilingCalc from './tools/DropCeilingCalc.jsx';
import MixDesignCalculator from './tools/MixDesignCalculator.jsx';
import CalculadoraCieloVisible from './tools/CalculadoraCieloVisible.jsx';
import CalculadoraMamposteria from './tools/CalculadoraMamposteria.jsx';
import CalculadoraLosaFundacion from './tools/CalculadoraLosaFundacion.jsx';
import { SiteConfigContext } from '../App.jsx';

const iconMap = {
  Grid, Layers, Container, Calculator, Zap, Wrench
};

export default function EngineeringTools() {
  const { tools } = cmsData;
  const siteConfig = useContext(SiteConfigContext);
  const [activeTool, setActiveTool] = useState(null);
  const navigate = useNavigate();

  const handleToolClick = (toolId) => {
    setActiveTool(toolId);
  };

  const renderTool = () => {
    switch (activeTool) {
      case 'cielo-raso':
        return <DropCeilingCalc />;
      case 'diseno-mezclas':
        return <MixDesignCalculator />;
      case 'visible-ceiling':
        return <CalculadoraCieloVisible />;
      case 'mamposteria':
        return <CalculadoraMamposteria />;
      case 'losa-fundacion':
        return <CalculadoraLosaFundacion />;
      default:
        return null;
    }
  };

  return (
    <div className="tools-container">
      <AnimatePresence mode="wait">
        {!activeTool ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="services-grid"
          >
            {tools.list.filter(tool => {
              if (!siteConfig || !siteConfig.tools) return true; // Default show all
              if (tool.id === 'cielo-raso') return siteConfig.tools.showCieloRaso !== false;
              if (tool.id === 'muro-gravedad') return siteConfig.tools.showMuroGravedad !== false;
              if (tool.id === 'diseno-mezclas') return siteConfig.tools.showDisenoMezclas !== false;
              if (tool.id === 'drywall') return siteConfig.tools.showDrywall !== false;
              if (tool.id === 'visible-ceiling') return siteConfig.tools.showCieloRasoVisible !== false;
              if (tool.id === 'electrica') return siteConfig.tools.showElectrica !== false;
              if (tool.id === 'escaleras') return siteConfig.tools.showEscaleras !== false;
              if (tool.id === 'losas') return siteConfig.tools.showLosas !== false;
              if (tool.id === 'mamposteria') return siteConfig.tools.showMamposteria !== false;
              if (tool.id === 'losa-fundacion') return siteConfig.tools.showLosaFundacion !== false;
              return true;
            }).map((tool, i) => {
              const Icon = iconMap[tool.icon] || Calculator;
              return (
                <motion.div
                  key={tool.id}
                  className="service-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleToolClick(tool.id)}
                  whileHover={{ y: -5 }}
                >
                  <div className="service-icon">
                    <Icon size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="service-title">{tool.title}</h3>
                  <p className="service-desc">{tool.desc}</p>
                  <div style={{ marginTop: '16px', color: 'var(--primary)', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Abrir Calculadora &rarr;
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="tool"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="card"
            style={{ padding: '32px', minHeight: '400px' }}
          >
            <button 
              className="btn btn-outline" 
              style={{ marginBottom: '24px', padding: '8px 16px', fontSize: '14px' }}
              onClick={() => setActiveTool(null)}
            >
              <ArrowLeft size={16} /> Volver al catálogo
            </button>
            {renderTool()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
