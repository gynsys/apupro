import React, { useState, useMemo } from 'react';
import { Package, Wrench, Users, Plus, Search, Trash2, Loader, Sparkles } from 'lucide-react';
import { numeroALetras } from '../utils/numberToLetters';
import EquipmentSelectorModal from './EquipmentSelectorModal';
import MaterialSelectorModal from './MaterialSelectorModal';
import LaborSelectorModal from './LaborSelectorModal';

export default function ApuEditorUI({
  item,
  settings,
  onHeaderChange,
  onHeaderBlur,
  onComponentChange,
  onComponentBlur,
  onRemoveRow,
  onAddBlankRow,
  onAddSearchRow,
  onSelectComponent,
  deletingId,
  onSettingsChange
}) {
  if (!item) return null;

  const {
    currency = 'USD',
    exchange_rate = 1.0,
    material_inflation = 0,
    equipment_inflation = 0,
    labor_inflation = 0,
    labor_bonus = 0,
    fcas_percent = 417,
    admin_percent = 15,
    profit_percent = 10,
    iva_percent = 0
  } = settings || {};

  const exRate = currency === 'BS' ? (exchange_rate || 1.0) : 1.0;

  // ── Calculations ─────────────────────────────────────────────────────────
  const calculateMaterialTotal = () => {
    return item.materials?.reduce((sum, mat) => {
      const baseCost = mat.cantidad * (mat.precio_unitario * exRate) * (1 + (mat.desperdicio || 0) / 100);
      return sum + (baseCost * (1 + (material_inflation / 100)));
    }, 0) || 0;
  };

  const calculateEquipmentTotalDay = () => {
    return item.equipments?.reduce((sum, eq) => {
      const baseCost = eq.cantidad * (eq.depreciacion ?? 1.0) * (eq.precio_unitario * exRate);
      return sum + (baseCost * (1 + (equipment_inflation / 100)));
    }, 0) || 0;
  };

  const calculateLaborTotalJornalDay = () => {
    return item.labors?.reduce((sum, lab) => {
      const baseCost = lab.cantidad * (lab.jornal * exRate);
      return sum + (baseCost * (1 + (labor_inflation / 100)));
    }, 0) || 0;
  };

  const calculateLaborTotalBonoDay = () => {
    return item.labors?.reduce((sum, lab) => {
      const bBonus = lab.bono || labor_bonus || 0;
      const baseCost = lab.cantidad * (bBonus * exRate);
      return sum + (baseCost * (1 + (labor_inflation / 100)));
    }, 0) || 0;
  };

  const calculateLaborTotalDay = () => {
    const totJornal = calculateLaborTotalJornalDay();
    const totBono = calculateLaborTotalBonoDay();
    const fcasMonto = totJornal * (fcas_percent / 100);
    return totJornal + totBono + fcasMonto;
  };

  const calculateCostosDirectos = () => {
    const matTotal = calculateMaterialTotal();
    const perf = item.performance || item.rendimiento || 1;
    const eqTotal = calculateEquipmentTotalDay() / perf;
    const labTotal = calculateLaborTotalDay() / perf;
    
    const subtotalA = matTotal + eqTotal + labTotal;
    const adminCost = subtotalA * (admin_percent / 100);
    const subtotalB = subtotalA + adminCost;
    const profitCost = subtotalB * (profit_percent / 100);
    
    const subtotalC = subtotalB + profitCost;
    const ivaCost = subtotalC * (iva_percent / 100);
    
    return {
      materiales: matTotal,
      equipos: eqTotal,
      manoObra: labTotal,
      subtotalA,
      adminCost,
      subtotalB,
      profitCost,
      subtotalC,
      ivaCost,
      unitPrice: subtotalC,
      unitPriceWithIva: subtotalC + ivaCost
    };
  };

  const renderOrigenTag = (origen) => {
    if (!origen || origen.toUpperCase() === 'HISTORICO') return null;
    if (origen === 'master') return <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border border-blue-200">Maestra</span>;
    if (origen === 'custom') return <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border border-purple-200">Personalizada</span>;
    if (origen === 'ai') return <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border border-emerald-200 flex items-center gap-1 w-fit"><Sparkles size={10}/> Generado IA</span>;
    return <span className="bg-slate-100 text-slate-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border border-slate-200">{origen}</span>;
  };

  const costos = calculateCostosDirectos();
  const safeFn = (fn) => typeof fn === 'function' ? fn : () => {};

  const [equipmentModal, setEquipmentModal] = useState({
    isOpen: false,
    targetRow: null
  });

  const [materialModal, setMaterialModal] = useState({
    isOpen: false,
    targetRow: null
  });

  const [laborModal, setLaborModal] = useState({
    isOpen: false,
    targetRow: null
  });

  const handleSelectEquipment = (selectedData) => {
    const target = equipmentModal.targetRow;
    setEquipmentModal({ isOpen: false, targetRow: null });

    if (target && target.id) {
      if (onSelectComponent) {
        onSelectComponent('equipments', target.id, selectedData);
      } else {
        safeFn(onComponentChange)('equipments', target.id, 'codigo', selectedData.codigo);
        safeFn(onComponentBlur)('equipments', target.id, 'codigo', selectedData.codigo);
        safeFn(onComponentChange)('equipments', target.id, 'descripcion', selectedData.descripcion);
        safeFn(onComponentBlur)('equipments', target.id, 'descripcion', selectedData.descripcion);
        safeFn(onComponentChange)('equipments', target.id, 'precio_unitario', selectedData.precio_unitario);
        safeFn(onComponentBlur)('equipments', target.id, 'precio_unitario', selectedData.precio_unitario);
      }
    } else {
      if (onSelectComponent) {
        onSelectComponent('equipments', null, selectedData);
      } else if (onAddSearchRow) {
        onAddSearchRow('equipments', selectedData);
      }
    }
  };

  const handleSelectMaterial = (selectedData) => {
    const target = materialModal.targetRow;
    setMaterialModal({ isOpen: false, targetRow: null });

    if (target && target.id) {
      if (onSelectComponent) {
        onSelectComponent('materials', target.id, selectedData);
      } else {
        safeFn(onComponentChange)('materials', target.id, 'codigo', selectedData.codigo);
        safeFn(onComponentBlur)('materials', target.id, 'codigo', selectedData.codigo);
        safeFn(onComponentChange)('materials', target.id, 'descripcion', selectedData.descripcion);
        safeFn(onComponentBlur)('materials', target.id, 'descripcion', selectedData.descripcion);
        safeFn(onComponentChange)('materials', target.id, 'unidad', selectedData.unidad);
        safeFn(onComponentBlur)('materials', target.id, 'unidad', selectedData.unidad);
        safeFn(onComponentChange)('materials', target.id, 'precio_unitario', selectedData.precio_unitario);
        safeFn(onComponentBlur)('materials', target.id, 'precio_unitario', selectedData.precio_unitario);
      }
    } else {
      if (onSelectComponent) {
        onSelectComponent('materials', null, selectedData);
      } else if (onAddSearchRow) {
        onAddSearchRow('materials', selectedData);
      }
    }
  };

  const handleSelectLabor = (selectedData) => {
    const target = laborModal.targetRow;
    setLaborModal({ isOpen: false, targetRow: null });

    if (target && target.id) {
      if (onSelectComponent) {
        onSelectComponent('labors', target.id, selectedData);
      } else {
        safeFn(onComponentChange)('labors', target.id, 'codigo', selectedData.codigo);
        safeFn(onComponentBlur)('labors', target.id, 'codigo', selectedData.codigo);
        safeFn(onComponentChange)('labors', target.id, 'descripcion', selectedData.descripcion);
        safeFn(onComponentBlur)('labors', target.id, 'descripcion', selectedData.descripcion);
        safeFn(onComponentChange)('labors', target.id, 'jornal', selectedData.jornal);
        safeFn(onComponentBlur)('labors', target.id, 'jornal', selectedData.jornal);
        safeFn(onComponentChange)('labors', target.id, 'bono', selectedData.bono);
        safeFn(onComponentBlur)('labors', target.id, 'bono', selectedData.bono);
      }
    } else {
      if (onSelectComponent) {
        onSelectComponent('labors', null, selectedData);
      } else if (onAddSearchRow) {
        onAddSearchRow('labors', selectedData);
      }
    }
  };

  const totJornal = calculateLaborTotalJornalDay();
  const totBono = calculateLaborTotalBonoDay();
  const fcasMonto = totJornal * (fcas_percent / 100);
  const totGeneralManoObra = totJornal + totBono + fcasMonto;
  const rendimiento = item.performance || item.rendimiento || 1;
  const costoUnitarioManoObra = totGeneralManoObra / rendimiento;
  const incidenciaManoObra = costos.unitPrice ? (costoUnitarioManoObra / costos.unitPrice) * 100 : 0;

  const horasLaborables = 8;
  const horasHombres = (item.labors || []).reduce((acc, lab) => acc + (parseFloat(lab.cantidad) || 0), 0) * horasLaborables;
  const horasHombresRend = horasHombres / rendimiento;
  const puHoras = horasHombresRend ? costos.unitPrice / horasHombresRend : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border-2 border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Código</span>
            <input 
              type="text" 
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm font-bold font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              value={item.CovPar || item.CodPar || item.cov_par || item.cod_par || item.codigo || ''}
              onChange={e => safeFn(onHeaderChange)(item.CovPar !== undefined ? 'CovPar' : (item.cov_par !== undefined ? 'cov_par' : 'cod_par'), e.target.value)}
              onBlur={e => safeFn(onHeaderBlur)(item.CovPar !== undefined ? 'CovPar' : (item.cov_par !== undefined ? 'cov_par' : 'cod_par'), e.target.value)}
              placeholder="Ej. CUST-001"
            />
          </div>
          <div className="md:col-span-3">
            <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Descripción</span>
            <input 
              type="text" 
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:border-blue-500"
              value={item.description || item.descripcion || ''}
              onChange={e => safeFn(onHeaderChange)('description', e.target.value)}
              onBlur={e => safeFn(onHeaderBlur)('description', e.target.value)}
              placeholder="Descripción de la partida"
            />
          </div>
        </div>

        <div className="flex flex-wrap border-b border-slate-200 bg-white">
          <div className="flex-1 p-3 border-r border-slate-100 min-w-[120px]">
            <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Unidad</span>
            <input 
              type="text" 
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              value={item.unit || item.unidad || ''}
              onChange={e => safeFn(onHeaderChange)('unit', e.target.value)}
              onBlur={e => safeFn(onHeaderBlur)('unit', e.target.value)}
            />
          </div>
          <div className="flex-1 p-3 border-r border-slate-100 min-w-[120px]">
            <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Cantidad Base</span>
            <span className="text-sm font-bold text-slate-700">1</span>
          </div>
          <div className="flex-1 p-3 border-r border-slate-100 min-w-[150px] bg-amber-50/30">
            <span className="block text-xs font-bold text-amber-700/70 uppercase mb-1">Rendimiento</span>
            <input 
              type="number" 
              className="w-full bg-amber-100/50 border-b-2 border-amber-300 focus:border-amber-500 focus:outline-none focus:bg-amber-100 px-1 font-bold text-amber-900 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={item.performance || item.rendimiento || 1}
              onChange={e => safeFn(onHeaderChange)('performance', e.target.value)}
              onBlur={e => safeFn(onHeaderBlur)('performance', e.target.value)}
            />
          </div>
          <div className="flex-1 p-3 min-w-[150px] bg-blue-50/50">
            <span className="block text-xs font-bold text-blue-500 uppercase mb-1">Precio Unitario ({currency})</span>
            <span className="text-lg font-black text-blue-700">
              {costos.unitPrice.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* 1. MATERIALES */}
        <div className="bg-white border border-slate-400 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="text-orange-600" size={18} />
              <h3 className="font-bold text-orange-800 text-sm tracking-wide">1. MATERIALES ( {item.materials?.length || 0} )</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMaterialModal({ isOpen: true, targetRow: null })}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
              >
                <Search size={14} /> Buscar
              </button>
              <button
                onClick={() => safeFn(onAddBlankRow)('materials')}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-50 hover:text-orange-600 transition-colors shadow-sm"
              >
                <Plus size={14} /> Fila
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-600">
                  <th className="p-2 w-24 border-r border-slate-200">Ref.</th>
                  <th className="p-2 border-r border-slate-200">Descripción</th>
                  <th className="p-2 w-16 text-center border-r border-slate-200">Und.</th>
                  <th className="p-2 w-24 text-right border-r border-slate-200">Cant.</th>
                  <th className="p-2 w-20 text-right border-r border-slate-200">Desp. %</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Precio</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Total</th>
                  <th className="p-2 w-16 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {item.materials?.map(mat => (
                  <tr key={mat.id} className="border-b border-slate-100 hover:bg-slate-50 group">
                    <td className="p-2 border-r border-slate-200 font-mono text-xs">
                      <input 
                        type="text" 
                        className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1"
                        value={mat.codigo || ''}
                        onChange={e => safeFn(onComponentChange)('materials', mat.id, 'codigo', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('materials', mat.id, 'codigo', e.target.value)}
                        placeholder="Ref."
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 text-xs">
                      <input 
                        type="text" 
                        className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 font-medium text-slate-700"
                        value={mat.descripcion || ''}
                        onChange={e => safeFn(onComponentChange)('materials', mat.id, 'descripcion', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('materials', mat.id, 'descripcion', e.target.value)}
                        placeholder="Descripción del material"
                      />
                      {(mat.origen || mat.nota_calculo) && (
                        <div className="flex items-center gap-2 mt-1 px-1">
                          {mat.origen && renderOrigenTag(mat.origen)}
                          {mat.nota_calculo && <span className="text-[10px] text-slate-500 italic truncate" title={mat.nota_calculo}>{mat.nota_calculo}</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-center border-r border-slate-200 text-xs">
                      <input 
                        type="text" 
                        className="w-full text-center bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1"
                        value={mat.unidad || ''}
                        onChange={e => safeFn(onComponentChange)('materials', mat.id, 'unidad', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('materials', mat.id, 'unidad', e.target.value)}
                        placeholder="Und"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-amber-50/40">
                      <input 
                        type="number" 
                        className="w-full text-right bg-transparent border-b border-amber-200 focus:border-amber-500 focus:outline-none focus:bg-amber-100 text-xs font-medium [appearance:textfield]"
                        value={mat.cantidad}
                        onChange={e => safeFn(onComponentChange)('materials', mat.id, 'cantidad', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('materials', mat.id, 'cantidad', e.target.value)}
                        />
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-amber-50/40">
                      <input 
                        type="number" 
                        className="w-full text-right bg-transparent border-b border-amber-200 focus:border-amber-500 focus:outline-none focus:bg-amber-100 text-xs font-medium [appearance:textfield]"
                        value={mat.desperdicio || 0}
                        onChange={e => safeFn(onComponentChange)('materials', mat.id, 'desperdicio', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('materials', mat.id, 'desperdicio', e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-amber-50/40">
                      <input 
                        type="number" 
                        className="w-full text-right bg-transparent border-b border-amber-200 focus:border-amber-500 focus:outline-none focus:bg-amber-100 text-xs font-medium [appearance:textfield]"
                        value={Number((mat.precio_unitario * exRate).toFixed(2))}
                        onChange={e => safeFn(onComponentChange)('materials', mat.id, 'precio_unitario', parseFloat(e.target.value) / exRate)}
                        onBlur={e => safeFn(onComponentBlur)('materials', mat.id, 'precio_unitario', parseFloat(e.target.value) / exRate)}
                      />
                    </td>
                    <td className="p-2 text-right font-semibold text-slate-700 bg-slate-50 text-xs border-r border-slate-200">
                      {((mat.cantidad * (mat.precio_unitario * exRate) * (1 + (mat.desperdicio || 0) / 100)) * (1 + (material_inflation/100))).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setMaterialModal({ isOpen: true, targetRow: mat })}
                          className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                          title="Buscar y seleccionar material del catálogo"
                        >
                          <Search size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => safeFn(onRemoveRow)('materials', mat.id)}
                          disabled={deletingId === mat.id}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="Eliminar insumo"
                        >
                          {deletingId === mat.id ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-300 flex justify-end items-center gap-4">
            <span className="text-xs font-bold text-slate-600 uppercase">Total Materiales:</span>
            <span className="text-sm font-black text-slate-800 bg-white border border-slate-300 px-3 py-1 rounded min-w-[120px] text-right">
              {costos.materiales.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
            </span>
          </div>
        </div>

        {/* 2. EQUIPOS */}
        <div className="bg-white border border-slate-400 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="text-indigo-600" size={18} />
              <h3 className="font-bold text-indigo-800 text-sm tracking-wide">2. EQUIPOS ( {item.equipments?.length || 0} )</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEquipmentModal({ isOpen: true, targetRow: null })}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
              >
                <Search size={14} /> Buscar
              </button>
              <button
                type="button"
                onClick={() => safeFn(onAddBlankRow)('equipments')}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
              >
                <Plus size={14} /> Fila
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-600">
                  <th className="p-2 w-24 border-r border-slate-200">Ref.</th>
                  <th className="p-2 border-r border-slate-200">Descripción</th>
                  <th className="p-2 w-24 text-right border-r border-slate-200">Cant.</th>
                  <th className="p-2 w-24 text-right border-r border-slate-200">Deprec.</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Precio</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Total Día</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Unitario</th>
                  <th className="p-2 w-16 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {item.equipments?.map(eq => (
                  <tr key={eq.id} className="border-b border-slate-100 hover:bg-slate-50 group">
                    <td className="p-2 border-r border-slate-200 font-mono text-xs">
                      <input 
                        type="text" 
                        className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1"
                        value={eq.codigo || ''}
                        onChange={e => safeFn(onComponentChange)('equipments', eq.id, 'codigo', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('equipments', eq.id, 'codigo', e.target.value)}
                        placeholder="Ref."
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 text-xs">
                      <input 
                        type="text" 
                        className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 font-medium text-slate-700"
                        value={eq.descripcion || ''}
                        onChange={e => safeFn(onComponentChange)('equipments', eq.id, 'descripcion', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('equipments', eq.id, 'descripcion', e.target.value)}
                        placeholder="Descripción del equipo"
                      />
                      {(eq.origen || eq.nota_calculo) && (
                        <div className="flex items-center gap-2 mt-1 px-1">
                          {eq.origen && renderOrigenTag(eq.origen)}
                          {eq.nota_calculo && <span className="text-[10px] text-slate-500 italic truncate" title={eq.nota_calculo}>{eq.nota_calculo}</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-amber-50/40">
                      <input 
                        type="number" 
                        className="w-full text-right bg-transparent border-b border-amber-200 focus:border-amber-500 focus:outline-none focus:bg-amber-100 text-xs font-medium [appearance:textfield]"
                        value={eq.cantidad}
                        onChange={e => safeFn(onComponentChange)('equipments', eq.id, 'cantidad', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('equipments', eq.id, 'cantidad', e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-amber-50/40">
                      <input 
                        type="number" 
                        className="w-full text-right bg-transparent border-b border-amber-200 focus:border-amber-500 focus:outline-none focus:bg-amber-100 text-xs font-medium [appearance:textfield]"
                        value={eq.depreciacion ?? 1.0}
                        onChange={e => safeFn(onComponentChange)('equipments', eq.id, 'depreciacion', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('equipments', eq.id, 'depreciacion', e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-amber-50/40">
                      <input 
                        type="number" 
                        className="w-full text-right bg-transparent border-b border-amber-200 focus:border-amber-500 focus:outline-none focus:bg-amber-100 text-xs font-medium [appearance:textfield]"
                        value={Number((eq.precio_unitario * exRate).toFixed(2))}
                        onChange={e => safeFn(onComponentChange)('equipments', eq.id, 'precio_unitario', parseFloat(e.target.value) / exRate)}
                        onBlur={e => safeFn(onComponentBlur)('equipments', eq.id, 'precio_unitario', parseFloat(e.target.value) / exRate)}
                      />
                    </td>
                    <td className="p-2 text-right font-semibold text-slate-700 bg-slate-50 text-xs border-r border-slate-200">
                      {((eq.cantidad * (eq.depreciacion ?? 1.0) * (eq.precio_unitario * exRate)) * (1 + (equipment_inflation/100))).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right font-bold text-slate-800 bg-white text-xs border-r border-slate-200">
                      {(((eq.cantidad * (eq.depreciacion ?? 1.0) * (eq.precio_unitario * exRate)) * (1 + (equipment_inflation/100))) / (item.performance || item.rendimiento || 1)).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEquipmentModal({ isOpen: true, targetRow: eq })}
                          className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded transition-colors"
                          title="Buscar y seleccionar equipo del catálogo"
                        >
                          <Search size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => safeFn(onRemoveRow)('equipments', eq.id)}
                          disabled={deletingId === eq.id}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="Eliminar equipo"
                        >
                          {deletingId === eq.id ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-300 flex justify-end items-center gap-4">
            <span className="text-xs font-bold text-slate-600 uppercase">Total Equipos (Día):</span>
            <span className="text-sm font-black text-slate-800 bg-white border border-slate-300 px-3 py-1 rounded min-w-[120px] text-right">
              {(costos.equipos * (item.performance || item.rendimiento || 1)).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
            </span>
          </div>
        </div>

        {/* 3. MANO DE OBRA */}
        <div className="bg-white border border-slate-400 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="text-teal-600" size={18} />
              <h3 className="font-bold text-teal-800 text-sm tracking-wide">3. MANO DE OBRA ( {item.labors?.length || 0} )</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLaborModal({ isOpen: true, targetRow: null })}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-50 hover:text-emerald-600 transition-colors shadow-sm"
              >
                <Search size={14} /> Buscar
              </button>
              <button
                onClick={() => safeFn(onAddBlankRow)('labors')}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-50 hover:text-teal-600 transition-colors shadow-sm"
              >
                <Plus size={14} /> Fila
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-600">
                  <th className="p-2 w-24 border-r border-slate-200">Ref.</th>
                  <th className="p-2 border-r border-slate-200">Descripción</th>
                  <th className="p-2 w-24 text-right border-r border-slate-200">Cant.</th>
                  <th className="p-2 w-28 text-right border-r border-slate-200">Jornal</th>
                  <th className="p-2 w-28 text-right border-r border-slate-200">Bono</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Total Jornal</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Total Bono</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Unitario</th>
                  <th className="p-2 w-16 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {item.labors?.map(lab => (
                  <tr key={lab.id} className="border-b border-slate-100 hover:bg-slate-50 group">
                    <td className="p-2 border-r border-slate-200 font-mono text-xs">
                      <input 
                        type="text" 
                        className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1"
                        value={lab.codigo || ''}
                        onChange={e => safeFn(onComponentChange)('labors', lab.id, 'codigo', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('labors', lab.id, 'codigo', e.target.value)}
                        placeholder="Ref."
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 text-xs">
                      <input 
                        type="text" 
                        className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 font-medium text-slate-700"
                        value={lab.descripcion || ''}
                        onChange={e => safeFn(onComponentChange)('labors', lab.id, 'descripcion', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('labors', lab.id, 'descripcion', e.target.value)}
                        placeholder="Descripción (ej. Maestro de Obra)"
                      />
                      {(lab.origen || lab.nota_calculo) && (
                        <div className="flex items-center gap-2 mt-1 px-1">
                          {lab.origen && renderOrigenTag(lab.origen)}
                          {lab.nota_calculo && <span className="text-[10px] text-slate-500 italic truncate" title={lab.nota_calculo}>{lab.nota_calculo}</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-amber-50/40">
                      <input 
                        type="number" 
                        className="w-full text-right bg-transparent border-b border-amber-200 focus:border-amber-500 focus:outline-none focus:bg-amber-100 text-xs font-medium [appearance:textfield]"
                        value={lab.cantidad}
                        onChange={e => safeFn(onComponentChange)('labors', lab.id, 'cantidad', e.target.value)}
                        onBlur={e => safeFn(onComponentBlur)('labors', lab.id, 'cantidad', e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-amber-50/40">
                      <input 
                        type="number" 
                        className="w-full text-right bg-transparent border-b border-amber-200 focus:border-amber-500 focus:outline-none focus:bg-amber-100 text-xs font-medium [appearance:textfield]"
                        value={Number((lab.jornal * exRate).toFixed(2))}
                        onChange={e => safeFn(onComponentChange)('labors', lab.id, 'jornal', parseFloat(e.target.value) / exRate)}
                        onBlur={e => safeFn(onComponentBlur)('labors', lab.id, 'jornal', parseFloat(e.target.value) / exRate)}
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-amber-50/40">
                      <input 
                        type="number" 
                        className="w-full text-right bg-transparent border-b border-amber-200 focus:border-amber-500 focus:outline-none focus:bg-amber-100 text-xs font-medium [appearance:textfield]"
                        value={Number(((lab.bono || labor_bonus || 0) * exRate).toFixed(2))}
                        disabled
                      />
                    </td>
                    <td className="p-2 text-right font-semibold text-slate-700 bg-slate-50 text-xs border-r border-slate-200">
                      {((lab.cantidad * (lab.jornal * exRate)) * (1 + (labor_inflation/100))).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right font-semibold text-slate-700 bg-slate-50 text-xs border-r border-slate-200">
                      {((lab.cantidad * ((lab.bono || labor_bonus || 0) * exRate)) * (1 + (labor_inflation/100))).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right font-bold text-slate-800 bg-white text-xs border-r border-slate-200">
                      {((((lab.cantidad * (lab.jornal * exRate)) * (1 + (labor_inflation/100))) * (1 + (fcas_percent/100)) + ((lab.cantidad * ((lab.bono || labor_bonus || 0) * exRate)) * (1 + (labor_inflation/100)))) / (item.performance || item.rendimiento || 1)).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setLaborModal({ isOpen: true, targetRow: lab })}
                          className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors"
                          title="Buscar y seleccionar mano de obra del catálogo"
                        >
                          <Search size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => safeFn(onRemoveRow)('labors', lab.id)}
                          disabled={deletingId === lab.id}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="Eliminar mano de obra"
                        >
                          {deletingId === lab.id ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 p-4 border-t border-slate-300">
            <div className="flex justify-end">
              <table className="w-full md:w-[650px] text-xs font-bold text-slate-700 border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-[11px] text-slate-500 font-semibold bg-slate-100/60">
                    <th className="p-1.5 text-right">Concepto</th>
                    <th className="p-1.5 w-28 text-right border-l border-slate-200">Total Jornal (Día)</th>
                    <th className="p-1.5 w-28 text-right border-l border-slate-200">Total Bono (Día)</th>
                    <th className="p-1.5 w-28 text-right border-l border-slate-200">Unitario</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 text-right border-b border-slate-200 uppercase">Subtotal Mano de Obra:</td>
                    <td className="p-2 text-right border-b border-slate-200 bg-white border-l border-slate-200">
                      {totJornal.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right border-b border-slate-200 bg-white border-l border-slate-200">
                      {totBono.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right border-b border-slate-200 bg-white border-l border-slate-200 text-slate-600">
                      {((totJornal + totBono) / rendimiento).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-right border-b border-slate-200 uppercase flex items-center justify-end gap-2">
                      <span>F.C.A.S. %</span>
                      {onSettingsChange ? (
                        <input 
                          type="number"
                          className="w-16 text-center bg-amber-50 text-amber-900 border border-amber-200 rounded px-1 [appearance:textfield]"
                          value={fcas_percent}
                          onChange={(e) => onSettingsChange('fcas_percent', parseFloat(e.target.value) || 0)}
                        />
                      ) : (
                        <span className="bg-amber-50 text-amber-900 px-2 py-0.5 border border-amber-200 rounded">{fcas_percent}</span>
                      )}
                      <span>Prestaciones Sociales:</span>
                    </td>
                    <td className="p-2 text-right border-b border-slate-200 bg-white border-l border-slate-200 text-slate-900">
                      {fcasMonto.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right border-b border-slate-200 bg-white border-l border-slate-200 text-slate-500">
                      {0.00.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right border-b border-slate-200 bg-white border-l border-slate-200 text-slate-600">
                      {(fcasMonto / rendimiento).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-right border-b border-slate-200 uppercase">Subtotal + Prestaciones:</td>
                    <td className="p-2 text-right border-b border-slate-200 bg-white border-l border-slate-200">
                      {(totJornal + fcasMonto).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right border-b border-slate-200 bg-white border-l border-slate-200">
                      {totBono.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right border-b border-slate-200 bg-white border-l border-slate-200 text-slate-600">
                      {((totJornal + fcasMonto + totBono) / rendimiento).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                  </tr>
                  <tr className="bg-slate-100">
                    <td className="p-2 text-right border-b border-slate-300 uppercase font-black">Total Diario Cuadrilla:</td>
                    <td colSpan={2} className="p-2 text-center border-b border-slate-300 bg-white font-black text-slate-900 border-l border-slate-200 shadow-inner">
                      {totGeneralManoObra.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right border-b border-slate-300 bg-slate-50 border-l border-slate-200"></td>
                  </tr>
                  <tr className="bg-red-50/50">
                    <td className="p-2 text-right border-b border-slate-300 uppercase flex items-center justify-end gap-2">
                      <span className="text-[10px] text-slate-500">% de Incidencia: {incidenciaManoObra.toLocaleString('es-VE', {minimumFractionDigits:4, maximumFractionDigits:4})}</span>
                      <span className="font-bold text-red-900">Costo Unitario Mano de Obra:</span>
                    </td>
                    <td colSpan={2} className="p-2 border-b border-slate-300 text-right pr-2 text-slate-500 font-normal">
                      (Total Diario ÷ Rendimiento {rendimiento}):
                    </td>
                    <td className="p-2 text-right border-b border-slate-300 bg-red-100/50 font-black text-red-900 border-l border-slate-200 shadow-inner">
                      {costoUnitarioManoObra.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* BOTTOM SUMMARY BLOCK */}
        {/* BOTTOM SUMMARY BLOCK (CLASSIC LULO STYLE) */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mt-8">
          {/* Left Stats Block */}
          <div className="w-full md:w-auto bg-slate-50 border border-slate-300 shadow-sm p-1">
            <table className="text-xs font-bold text-slate-700 border-collapse">
              <tbody>
                <tr>
                  <td className="p-2 text-right border-b border-slate-200 uppercase">Horas Laborables al Día:</td>
                  <td className="p-2 w-32 text-center border-b border-slate-200 bg-white border-l border-slate-200 shadow-inner">
                    {horasLaborables.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-right border-b border-slate-200 uppercase">Horas Hombres x Día:</td>
                  <td className="p-2 w-32 text-center border-b border-slate-200 bg-white border-l border-slate-200 shadow-inner">
                    {horasHombres.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-right border-b border-slate-200 uppercase">Horas Hombres x Día / Rend.:</td>
                  <td className="p-2 w-32 text-center border-b border-slate-200 bg-white border-l border-slate-200 shadow-inner">
                    {horasHombresRend.toLocaleString('es-VE', {minimumFractionDigits:3, maximumFractionDigits:3})}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-right uppercase">PU / (Horas Hombres x Día / Rend.):</td>
                  <td className="p-2 w-32 text-center bg-white border-l border-slate-200 shadow-inner">
                    {puHoras.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right Summary Block */}
          <div className="w-full md:w-[600px] bg-slate-50 border border-slate-300 shadow-md p-1">
            <table className="w-full text-xs font-bold text-slate-700 border-collapse">
              <tbody>
                <tr className="bg-blue-50/50">
                  <td className="p-2 text-right border-b border-slate-200 text-blue-900 uppercase font-black">Costo Directo Subtotal A:</td>
                  <td className="p-2 w-36 text-right border-b border-slate-200 bg-blue-100/50 text-blue-900 font-black border-l border-slate-200 shadow-inner">
                    {costos.subtotalA.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-right border-b border-slate-200 flex items-center justify-end gap-2 uppercase">
                    <span>%</span>
                    {onSettingsChange ? (
                      <input 
                        type="number"
                        className="w-16 text-center bg-amber-50 text-amber-900 border border-amber-200 rounded px-1 [appearance:textfield]"
                        value={admin_percent}
                        onChange={(e) => onSettingsChange('admin_percent', parseFloat(e.target.value) || 0)}
                      />
                    ) : (
                      <span className="bg-amber-50 text-amber-900 px-2 py-0.5 border border-amber-200 rounded">{admin_percent}</span>
                    )}
                    <span>Administración y Gastos Generales:</span>
                  </td>
                  <td className="p-2 w-36 text-right border-b border-slate-200 bg-white border-l border-slate-200">
                    {costos.adminCost.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-slate-100">
                  <td className="p-2 text-right border-b border-slate-300 text-red-700 uppercase font-black">Subtotal B:</td>
                  <td className="p-2 w-36 text-right border-b border-slate-300 bg-white border-l border-slate-200 font-bold">
                    {costos.subtotalB.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-right border-b border-slate-200 flex items-center justify-end gap-2 uppercase">
                    <span>%</span>
                    {onSettingsChange ? (
                      <input 
                        type="number"
                        className="w-16 text-center bg-amber-50 text-amber-900 border border-amber-200 rounded px-1 [appearance:textfield]"
                        value={profit_percent}
                        onChange={(e) => onSettingsChange('profit_percent', parseFloat(e.target.value) || 0)}
                      />
                    ) : (
                      <span className="bg-amber-50 text-amber-900 px-2 py-0.5 border border-amber-200 rounded">{profit_percent}</span>
                    )}
                    <span>Utilidad e Imprevistos:</span>
                  </td>
                  <td className="p-2 w-36 text-right border-b border-slate-200 bg-white border-l border-slate-200">
                    {costos.profitCost.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-slate-100">
                  <td className="p-2 text-right border-b border-slate-300 text-red-700 uppercase font-black">Subtotal C:</td>
                  <td className="p-2 w-36 text-right border-b border-slate-300 bg-blue-50/50 border-l border-slate-200 font-bold">
                    {costos.subtotalC.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-right border-b border-slate-200 flex items-center justify-end gap-2 uppercase">
                    <span>%</span>
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 border border-slate-200 rounded">0.00</span>
                    <span>Financiamiento:</span>
                  </td>
                  <td className="p-2 w-36 text-right border-b border-slate-200 bg-white border-l border-slate-200 text-slate-500">
                    {0.00.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                {iva_percent > 0 ? (
                  <>
                    <tr className="bg-slate-100">
                      <td className="p-2 text-right border-b border-slate-300 text-slate-700 uppercase font-black">Precio Unitario Sin Impuesto:</td>
                      <td className="p-2 w-36 text-right border-b border-slate-300 bg-blue-50/50 border-l border-slate-200 font-bold text-blue-900">
                        {costos.subtotalC.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 text-right border-b border-slate-200 flex items-center justify-end gap-2 uppercase">
                        <span>%</span>
                        {onSettingsChange ? (
                          <input 
                            type="number"
                            className="w-16 text-center bg-amber-50 text-amber-900 border border-amber-200 rounded px-1 [appearance:textfield]"
                            value={iva_percent}
                            onChange={(e) => onSettingsChange('iva_percent', parseFloat(e.target.value) || 0)}
                          />
                        ) : (
                          <span className="bg-amber-50 text-amber-900 px-2 py-0.5 border border-amber-200 rounded">{iva_percent}</span>
                        )}
                        <span>Impuesto IVA:</span>
                      </td>
                      <td className="p-2 w-36 text-right border-b border-slate-200 bg-white border-l border-slate-200 text-slate-500">
                        {costos.ivaCost.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 text-right border-b border-slate-200 flex items-center justify-end gap-2 uppercase">
                        <span>%</span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 border border-slate-200 rounded">0.00</span>
                        <span>Otros Impuestos:</span>
                      </td>
                      <td className="p-2 w-36 text-right border-b border-slate-200 bg-white border-l border-slate-200 text-slate-500">
                        {0.00.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="p-3 text-right uppercase font-black text-blue-900 text-sm">Precio Unitario con IVA ({currency}):</td>
                      <td className="p-3 w-36 text-right font-black text-sm border-l border-slate-300 bg-white shadow-inner text-blue-800">
                        {costos.unitPriceWithIva.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td colSpan={2} className="p-3 text-center text-[11px] font-bold text-slate-500 border-t border-slate-200">
                        SON: ( {numeroALetras(costos.unitPriceWithIva)} {String(currency).toUpperCase().includes('USD') ? 'DÓLARES' : 'Bs.'} ctms )
                      </td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr className="bg-blue-50">
                      <td className="p-3 text-right uppercase font-black text-blue-900 text-sm">Precio Unitario ({currency}):</td>
                      <td className="p-3 w-36 text-right font-black text-sm border-l border-slate-300 bg-white shadow-inner text-blue-800">
                        {costos.subtotalC.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td colSpan={2} className="p-3 text-center text-[11px] font-bold text-slate-500 border-t border-slate-200">
                        SON: ( {numeroALetras(costos.subtotalC)} {String(currency).toUpperCase().includes('USD') ? 'DÓLARES' : 'Bs.'} ctms )
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <EquipmentSelectorModal
        isOpen={equipmentModal.isOpen}
        onClose={() => setEquipmentModal({ isOpen: false, targetRow: null })}
        onSelect={handleSelectEquipment}
        targetRow={equipmentModal.targetRow}
      />

      <MaterialSelectorModal
        isOpen={materialModal.isOpen}
        onClose={() => setMaterialModal({ isOpen: false, targetRow: null })}
        onSelect={handleSelectMaterial}
        targetRow={materialModal.targetRow}
      />

      <LaborSelectorModal
        isOpen={laborModal.isOpen}
        onClose={() => setLaborModal({ isOpen: false, targetRow: null })}
        onSelect={handleSelectLabor}
        targetRow={laborModal.targetRow}
      />
    </div>
  );
}
