import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Settings2, Droplets, HardHat, Info, ChevronDown, Ruler } from 'lucide-react';

const AGGREGATE_FACTORS = {
  '3"': 0.82,
  '2 1/2"': 0.85,
  '2"': 0.88,
  '1 1/2"': 0.93,
  '1"': 1.00,
  '3/4"': 1.05,
  '1/2"': 1.14
};

const Z_FACTORS = {
  1: 2.326,
  2: 2.054,
  3: 1.881,
  4: 1.751,
  5: 1.645,
  10: 1.282,
  15: 1.036,
  20: 0.842
};

const MixDesignCalculator = () => {
  // Input State
  const [inputs, setInputs] = useState({
    volume: 1.0,           // Volumen (m3)
    largo: 0.0,            // Largo (m)
    ancho: 0.0,            // Ancho (m)
    altura: 0.0,           // Altura (m)
    fc: 250.0,             // f'c (Kg/cm2)
    slump: 5.0,            // Asentamiento (Pulgadas)
    fractil: 10,           // Fractil (%)
    stdDev: 10,            // Desviación Estándar 's'
    stoneSize: '3/4"',     // Piedra Nº (Tamaño)
    
    // Propiedades
    gFino: 2.7,
    gGrueso: 2.64,
    b: 0.55,
    humFino: 3.5,
    humGrueso: 0.5,
    absFino: 2.0,
    absGrueso: 1.0
  });

  const [unit, setUnit] = useState('Kg'); // 'Kg', 'Cuñetes', 'Paladas'

  const [results, setResults] = useState({
    cemento: 0,
    agua: 0,
    arena: 0,
    piedra: 0,
    densidad: 0
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Cost States
  const [costs, setCosts] = useState({
    cemento: 15,
    arena: 60,
    piedra: 60,
    agua: 0,
    obreros: 4,
    precioObrero: 20,
    maestros: 1,
    precioMaestro: 40,
    precioTrompo: 60,
    mixMethod: 'trompo',
    rendimiento: 5.0
  });
  const [showCostModal, setShowCostModal] = useState(false);

  const handleMixMethodChange = (method) => {
    setCosts(prev => ({
      ...prev,
      mixMethod: method,
      rendimiento: parseFloat(((method === 'trompo' ? 1.25 : 0.6875) * prev.obreros).toFixed(2))
    }));
  };

  const handleObrerosChange = (newObreros) => {
    const obreros = parseFloat(newObreros) || 0;
    setCosts(prev => ({
      ...prev,
      obreros: obreros,
      // Auto-ajustar rendimiento basado en la cantidad de obreros
      rendimiento: parseFloat(((prev.mixMethod === 'trompo' ? 1.25 : 0.6875) * obreros).toFixed(2))
    }));
  };

  const calculateTotalCost = () => {
    const rawCement = parseFloat(results.cemento) || 0;
    const rawSand = parseFloat(results.arena) || 0;
    const rawStone = parseFloat(results.piedra) || 0;
    const rawWater = parseFloat(results.agua) || 0;
    
    // Cemento is in Kg, 1 bag = 42.5kg
    const cementCost = (rawCement / 42.5) * costs.cemento;
    // Arena/Piedra are in Kg, convert to m3 using their density (g * 1000)
    const sandCost = (rawSand / ((parseFloat(inputs.gFino) || 2.7) * 1000)) * costs.arena;
    const stoneCost = (rawStone / ((parseFloat(inputs.gGrueso) || 2.64) * 1000)) * costs.piedra;
    const waterCost = rawWater * costs.agua;
    
    // Labor cost calculation based on yield (rendimiento)
    const eqCost = costs.mixMethod === 'trompo' ? costs.precioTrompo : 0;
    const dailyLaborCost = (costs.obreros * costs.precioObrero) + (costs.maestros * costs.precioMaestro) + eqCost;
    
    const yieldM3 = parseFloat(costs.rendimiento) || 1; // Avoid division by zero
    const costPerM3 = dailyLaborCost / yieldM3;
    const totalLaborCost = costPerM3 * (parseFloat(inputs.volume) || 1);
    
    return cementCost + sandCost + stoneCost + waterCost + totalLaborCost;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const val = name === 'stoneSize' ? value : parseFloat(value) || 0;
    
    setInputs(prev => {
      const newInputs = { ...prev, [name]: val };
      // Si se modificó largo, ancho o altura, calcular el volumen automáticamente
      if (['largo', 'ancho', 'altura'].includes(name)) {
        const l = name === 'largo' ? val : prev.largo;
        const w = name === 'ancho' ? val : prev.ancho;
        const h = name === 'altura' ? val : prev.altura;
        if (l > 0 && w > 0 && h > 0) {
          newInputs.volume = parseFloat((l * w * h).toFixed(3));
        }
      }
      return newInputs;
    });
  };

  // Math Engine
  useEffect(() => {
    const calculateMix = () => {
      const { 
        volume, fc, slump, fractil, stdDev, stoneSize, 
        gFino, gGrueso, b, humFino, humGrueso, absFino, absGrueso
      } = inputs;

      const Z = Z_FACTORS[fractil] || 1.282; // Default 10%
      const s = stdDev;
      const fCorr = AGGREGATE_FACTORS[stoneSize] || 1.05;

      // --- Cemento Base ---
      // = (117.2 * (3.147 - (0.4625 * LN(fc + s*Z)))^-1.3 * ((slump * 2.54)^0.16)) * fCorr
      const logTerm = fc + s * Z;
      const baseTerm = 3.147 - (0.4625 * Math.log(logTerm));
      const powTerm1 = Math.pow(baseTerm, -1.3);
      const powTerm2 = Math.pow(slump * 2.54, 0.16);
      
      const cementoBase = (117.2 * powTerm1 * powTerm2) * fCorr;

      // --- Agua Base ---
      // = Cemento * (3.147 - (0.4625 * LN(fc + Z*s)))
      const aguaBase = cementoBase * baseTerm;

      // --- Arena Base ---
      // = (((1000 - (0.3 * cementoBase) - aguaBase - (cementoBase / 25)) * (gGrueso * b + (1 - b) * gFino)) * b)
      const volumetricFactor = (gGrueso * b + (1 - b) * gFino);
      const arenaBase = ((1000 - (0.3 * cementoBase) - aguaBase - (cementoBase / 25)) * volumetricFactor) * b;

      // --- Piedra Base ---
      // = ((Arena / b) - Arena)
      const piedraBase = (arenaBase / b) - arenaBase;

      // --- Correcciones por Humedad y Absorción ---
      // Gw = Piedra - ((100 + humGrueso) / (100 + absGrueso)) * Piedra
      const Gw = piedraBase - ((100 + humGrueso) / (100 + absGrueso)) * piedraBase;
      // Aw = Arena - ((100 + humFino) / (100 + absFino)) * Arena
      const Aw = arenaBase - ((100 + humFino) / (100 + absFino)) * arenaBase;
      // Agua Necesaria = Agua Base + Gw + Aw
      const aguaNecesaria = aguaBase + Gw + Aw;

      // --- Factor Volumétrico y Desperdicio ---
      // 1.54044% es el factor encontrado en el excel (0.0154044)
      const wFactor = 1.0154044;
      
      const finalCemento = cementoBase * volume * wFactor;
      const finalAgua = aguaNecesaria * volume * wFactor;
      const finalArena = arenaBase * volume * wFactor;
      const finalPiedra = piedraBase * volume * wFactor;
      
      // Densidad Kg/m3 = Suma de bases
      const densidad = (cementoBase + arenaBase + piedraBase + aguaNecesaria);

      setResults({
        cemento: finalCemento.toFixed(2),
        agua: finalAgua.toFixed(2),
        arena: finalArena.toFixed(2),
        piedra: finalPiedra.toFixed(2),
        densidad: densidad.toFixed(2)
      });
    };

    try {
      calculateMix();
    } catch (err) {
      console.error("Error en calculo de mezcla:", err);
    }
  }, [inputs]);

  // Derived values depending on selected unit
  const displayResults = useMemo(() => {
    const rawCement = parseFloat(results.cemento) || 0;
    const rawWater = parseFloat(results.agua) || 0;
    const rawSand = parseFloat(results.arena) || 0;
    const rawStone = parseFloat(results.piedra) || 0;

    if (unit === 'Paladas') {
      return {
        cemento: rawCement.toFixed(2),
        cementoUnit: 'Kg',
        agua: (rawWater / 20).toFixed(1),
        aguaUnit: 'Cuñetes',
        arena: Math.round(rawSand / 7.5).toString(),
        arenaUnit: 'Paladas',
        piedra: Math.round(rawStone / 6).toString(),
        piedraUnit: 'Paladas'
      };
    } else if (unit === 'Cuñetes') {
      return {
        cemento: rawCement.toFixed(2),
        cementoUnit: 'Kg',
        agua: (rawWater / 20).toFixed(1),
        aguaUnit: 'Cuñetes',
        arena: (rawSand / 32).toFixed(1),
        arenaUnit: 'Cuñetes',
        piedra: (rawStone / 29).toFixed(1),
        piedraUnit: 'Cuñetes'
      };
    } else {
      // Default: Kg
      return {
        cemento: rawCement.toFixed(2),
        cementoUnit: 'Kg',
        agua: rawWater.toFixed(2),
        aguaUnit: 'Kg / Litros',
        arena: rawSand.toFixed(2),
        arenaUnit: 'Kg',
        piedra: rawStone.toFixed(2),
        piedraUnit: 'Kg'
      };
    }
  }, [results, unit]);

  const rawCement = parseFloat(results.cemento) || 0;

  return (
    <div className="bg-slate-50 min-h-screen p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="mb-10 text-center md:text-left">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center md:justify-start gap-3">
            <Calculator className="w-10 h-10 text-amber-500" />
            Diseño de Mezclas
          </h1>
          <p className="text-slate-500 mt-2 text-lg">Sistema avanzado de dosificación de concreto verificado por ensayos de laboratorios.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Panel de Entradas */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
              <Settings2 className="w-5 h-5 text-slate-400" />
              <h2 className="text-xl font-bold text-slate-800">Parámetros de Diseño</h2>
            </div>

            <div className="space-y-5">

              {/* Cálculo de Volumen por Dimensiones */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  <Ruler className="w-4 h-4 text-amber-500" /> Cálculo de Volumen por Dimensiones
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">Largo (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="largo"
                      value={inputs.largo || ''}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">Ancho (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="ancho"
                      value={inputs.ancho || ''}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">Altura (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="altura"
                      value={inputs.altura || ''}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Volumen Total (m³)</label>
                  <input type="number" step="0.1" name="volume" value={inputs.volume} onChange={handleInputChange} 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-semibold" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Resistencia f'c (Kg/cm²)</label>
                  <input type="number" name="fc" value={inputs.fc} onChange={handleInputChange} 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Asentamiento (Pulg.)</label>
                  <input type="number" step="0.5" name="slump" value={inputs.slump} onChange={handleInputChange} 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Tamaño Agregado</label>
                  <select name="stoneSize" value={inputs.stoneSize} onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all">
                    {Object.keys(AGGREGATE_FACTORS).map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Fracción Defectuosa (%)</label>
                  <select name="fractil" value={inputs.fractil} onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all">
                    {Object.keys(Z_FACTORS).map(f => (
                      <option key={f} value={f}>{f}%</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Desviación Estándar (s)</label>
                  <input type="number" step="1" name="stdDev" value={inputs.stdDev} onChange={handleInputChange} 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all" />
                </div>
              </div>

              {/* Botón de Avanzados */}
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between mt-6 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-lg font-medium transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Factores de Corrección Avanzados
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {/* Panel Avanzado */}
              {showAdvanced && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Densidad Fino (gG)</label>
                        <input type="number" step="0.01" name="gFino" value={inputs.gFino} onChange={handleInputChange} className="w-full p-2 text-sm border rounded" />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Densidad Grueso (gA)</label>
                        <input type="number" step="0.01" name="gGrueso" value={inputs.gGrueso} onChange={handleInputChange} className="w-full p-2 text-sm border rounded" />
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Humedad Fino (%)</label>
                        <input type="number" step="0.1" name="humFino" value={inputs.humFino} onChange={handleInputChange} className="w-full p-2 text-sm border rounded" />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Humedad Grueso (%)</label>
                        <input type="number" step="0.1" name="humGrueso" value={inputs.humGrueso} onChange={handleInputChange} className="w-full p-2 text-sm border rounded" />
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Absorción Fino (%)</label>
                        <input type="number" step="0.1" name="absFino" value={inputs.absFino} onChange={handleInputChange} className="w-full p-2 text-sm border rounded" />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Absorción Grueso (%)</label>
                        <input type="number" step="0.1" name="absGrueso" value={inputs.absGrueso} onChange={handleInputChange} className="w-full p-2 text-sm border rounded" />
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Factor b</label>
                        <input type="number" step="0.01" name="b" value={inputs.b} onChange={handleInputChange} className="w-full p-2 text-sm border rounded" />
                     </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel de Resultados */}
          <div className="lg:col-span-7">
            {/* Selector de Unidad con Bordes y Hover */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
              <label className="block text-sm font-extrabold text-slate-800 mb-3 uppercase tracking-wider">
                Dosificación de Resultados en:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Kg', 'Cuñetes', 'Paladas'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setUnit(option)}
                    className={`py-2.5 px-4 text-sm font-extrabold rounded-xl border border-solid transition-all duration-200 shadow-sm ${
                      unit === option
                        ? 'bg-amber-500 border-amber-600 text-white hover:bg-amber-600 hover:border-amber-700'
                        : 'bg-white border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Tarjeta Cemento */}
              <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-700 rounded-full -mr-10 -mt-10 opacity-20 group-hover:scale-110 transition-transform"></div>
                <h3 className="text-slate-300 font-medium text-sm flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-slate-400" />
                  CEMENTO REQUERIDO
                </h3>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-5xl font-black text-white tracking-tighter">{displayResults.cemento}</span>
                  <span className="text-slate-400 font-medium pb-2">{displayResults.cementoUnit}</span>
                </div>
                <p className="mt-4 text-xs text-slate-400 font-medium px-3 py-1 bg-slate-700/50 inline-block rounded-full">
                  ~ {(rawCement / 42.5).toFixed(1)} Sacos
                </p>
              </div>

              {/* Tarjeta Agua */}
              <div className="bg-blue-600 p-6 rounded-2xl shadow-xl border border-blue-500 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform"></div>
                <h3 className="text-blue-100 font-medium text-sm flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-200" />
                  AGUA REQUERIDA
                </h3>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-5xl font-black text-white tracking-tighter">{displayResults.agua}</span>
                  <span className="text-blue-200 font-medium pb-2">{displayResults.aguaUnit}</span>
                </div>
              </div>

              {/* Tarjeta Arena */}
              <div className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-200 relative overflow-hidden">
                <h3 className="text-amber-800 font-medium text-sm uppercase tracking-wider">ARENA</h3>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-4xl font-bold text-amber-600 tracking-tight">{displayResults.arena}</span>
                  <span className="text-amber-500 font-medium pb-1">{displayResults.arenaUnit}</span>
                </div>
                <p className="mt-2 text-xs text-amber-600/70">Agregado Fino</p>
              </div>

              {/* Tarjeta Piedra */}
              <div className="bg-slate-100 p-6 rounded-2xl shadow-sm border border-slate-300 relative overflow-hidden">
                <h3 className="text-slate-600 font-medium text-sm uppercase tracking-wider">PIEDRA PICADA</h3>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-800 tracking-tight">{displayResults.piedra}</span>
                  <span className="text-slate-500 font-medium pb-1">{displayResults.piedraUnit}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Agregado Grueso</p>
              </div>

              {/* Resumen Densidad */}
              <div className="sm:col-span-2 bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-slate-300 font-medium text-sm">DENSIDAD DEL CONCRETO (DISEÑO)</h3>
                  <p className="text-slate-400 text-xs mt-1">Peso unitario para 1 m³ sin desperdicio</p>
                </div>
                <div className="text-right flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-amber-500">{results.densidad}</span>
                  <span className="text-slate-400 text-sm">Kg/m³</span>
                </div>
              </div>

              {/* Resumen Costos */}
              <div className="sm:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-emerald-500 mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-emerald-700 font-black text-lg">COSTO TOTAL ESTIMADO</h3>
                  <button onClick={() => setShowCostModal(true)} className="text-emerald-600 text-sm font-bold hover:underline mt-1 flex items-center gap-1">
                    Personalizar precios (APU) &rarr;
                  </button>
                </div>
                <div className="text-right flex items-baseline gap-2">
                  <span className="text-4xl font-black text-emerald-600">${calculateTotalCost().toFixed(2)}</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Modal de Costos (APU) */}
      {showCostModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1001] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-500" />
                Análisis de Precio Unitario
              </h2>
              <button onClick={() => setShowCostModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider border-b pb-2">Materiales</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Cemento ($/Saco 42.5kg)</label>
                    <input type="number" step="0.5" value={costs.cemento} onChange={(e) => setCosts({...costs, cemento: parseFloat(e.target.value)||0})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Arena ($/m³)</label>
                    <input type="number" step="1" value={costs.arena} onChange={(e) => setCosts({...costs, arena: parseFloat(e.target.value)||0})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Piedra Picada ($/m³)</label>
                    <input type="number" step="1" value={costs.piedra} onChange={(e) => setCosts({...costs, piedra: parseFloat(e.target.value)||0})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Agua ($/Litro)</label>
                    <input type="number" step="0.01" value={costs.agua} onChange={(e) => setCosts({...costs, agua: parseFloat(e.target.value)||0})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider border-b pb-2">Mano de Obra & Equipos (Por Jornada)</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Método de Mezclado</label>
                    <select 
                      value={costs.mixMethod} 
                      onChange={(e) => handleMixMethodChange(e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="trompo">A Trompo (Mezcladora)</option>
                      <option value="manual">Manual (A Pala)</option>
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Rendimiento (m³ / Día)</label>
                    <input type="number" step="0.1" value={costs.rendimiento} onChange={(e) => setCosts({...costs, rendimiento: parseFloat(e.target.value)||0})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nº Obreros</label>
                    <input type="number" step="1" value={costs.obreros} onChange={(e) => handleObrerosChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Costo Obrero ($/Día)</label>
                    <input type="number" step="1" value={costs.precioObrero} onChange={(e) => setCosts({...costs, precioObrero: parseFloat(e.target.value)||0})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nº Maestros</label>
                    <input type="number" step="1" value={costs.maestros} onChange={(e) => setCosts({...costs, maestros: parseFloat(e.target.value)||0})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Costo Maestro ($/Día)</label>
                    <input type="number" step="1" value={costs.precioMaestro} onChange={(e) => setCosts({...costs, precioMaestro: parseFloat(e.target.value)||0})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>
                  {costs.mixMethod === 'trompo' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Alquiler Trompo / Equipo ($/Día)</label>
                      <input type="number" step="1" value={costs.precioTrompo} onChange={(e) => setCosts({...costs, precioTrompo: parseFloat(e.target.value)||0})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button onClick={() => setShowCostModal(false)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold transition-colors">
                Aplicar Precios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MixDesignCalculator;
