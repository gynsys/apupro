import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Loader, Save, Calculator, Sparkles, X, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { AuthContext } from '../../../../context/AuthContext';
import { useUserCostos } from '../../../../context/UserCostosContext';
import { saveCustomApu } from '../../services/cost360Service';

import ApuEditorUI from '../../../../components/ApuEditorUI';
import SubscriptionRequestModal from '../../../../components/SubscriptionRequestModal';

import ExactMatchCard from './ExactMatchCard';
import ClarificationAlertCard from './ClarificationAlertCard';
import GuidedAssistantModal from './GuidedAssistantModal';
import FreeTextPromptInput from './FreeTextPromptInput';
import SmartFilterCard from './SmartFilterCard';

import { useGuidedAssistant } from '../../hooks/useGuidedAssistant';
import { useApuGenerator } from '../../hooks/useApuGenerator';

export default function AIApuGeneratorModal({
  isOpen,
  onClose,
  onInsertToBudget,
  budgetSettings
}) {
  if (!isOpen) return null;

  const { user } = useContext(AuthContext);
  const isSuperAdmin = Boolean(
    user?.is_superadmin === true ||
    user?.email === 'admin@arko360.net' ||
    user?.role === 'superadmin' ||
    user?.is_admin === true
  );
  const { costosConfig, updateCostosConfig } = useUserCostos();

  const [prompt, setPrompt] = useState('');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [saving, setSaving] = useState(false);

  // Settings heredados del presupuesto o de la configuración del usuario
  const [settings, setSettings] = useState(() => ({
    fcas_percent: budgetSettings?.fcas_percent ?? costosConfig?.fcas ?? 417,
    admin_percent: budgetSettings?.admin_percent ?? costosConfig?.porcentajeAdministracion ?? 15.0,
    profit_percent: budgetSettings?.profit_percent ?? costosConfig?.porcentajeUtilidad ?? 10.0,
    iva_percent: budgetSettings?.iva_percent ?? 0,
    labor_bonus: budgetSettings?.labor_bonus ?? 0,
    currency: budgetSettings?.currency ?? 'USD'
  }));

  useEffect(() => {
    if (costosConfig && !budgetSettings) {
      setSettings(prev => ({
        ...prev,
        fcas_percent: costosConfig.fcas ?? prev.fcas_percent,
        admin_percent: costosConfig.porcentajeAdministracion ?? prev.admin_percent,
        profit_percent: costosConfig.porcentajeUtilidad ?? prev.profit_percent,
      }));
    }
  }, [costosConfig, budgetSettings]);

  // Hook generador de APU con IA
  const generator = useApuGenerator({ setSettings });

  // Hook del asistente guiado (chatbot)
  const guided = useGuidedAssistant({
    user,
    initialGuided: true,
    onComplete: (finalPrompt, source, unit, executionDays) => {
      setPrompt(finalPrompt);
      if (unit) setSelectedUnit(unit);
      generator.handleGenerate(finalPrompt, false, false, false, null, source, unit, executionDays);
    }
  });

  const handleComponentChange = (type, compId, field, value) => {
    generator.setItem(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated[type] = (updated[type] || []).map(c => {
        if (c.id === compId) {
          const isNumeric = ['cantidad', 'precio_unitario', 'desperdicio', 'depreciacion', 'jornal'].includes(field);
          return { ...c, [field]: isNumeric ? (parseFloat(value) || 0) : value };
        }
        return c;
      });
      return updated;
    });
  };

  const handleAddRow = (type) => {
    generator.setItem(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      const newRow = {
        id: 'NEW-' + Math.floor(Math.random() * 100000),
        codigo: '',
        descripcion: '',
        cantidad: 1,
        precio_unitario: 0,
      };

      if (type === 'materials') {
        newRow.unidad = 'und';
        newRow.desperdicio = 0;
      } else if (type === 'equipments') {
        newRow.depreciacion = 1.0;
      } else if (type === 'labors') {
        newRow.jornal = 0;
      }

      updated[type] = [...(updated[type] || []), newRow];
      return updated;
    });
  };

  const handleRemoveRow = (type, rowId) => {
    generator.setItem(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated[type] = (updated[type] || []).filter(c => c.id !== rowId);
      return updated;
    });
  };

  const handleSelectComponent = (type, compId, selectedData) => {
    generator.setItem(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (compId) {
        updated[type] = (updated[type] || []).map(c => {
          if (c.id === compId) {
            return {
              ...c,
              codigo: selectedData.codigo || c.codigo,
              descripcion: selectedData.descripcion || c.descripcion,
              precio_unitario: selectedData.precio_unitario != null ? selectedData.precio_unitario : c.precio_unitario,
              ...(type === 'materials' ? {
                unidad: selectedData.unidad || c.unidad,
                desperdicio: selectedData.desperdicio != null ? selectedData.desperdicio : (c.desperdicio ?? 5.0)
              } : {}),
              ...(type === 'equipments' ? {
                depreciacion: selectedData.depreciacion != null ? selectedData.depreciacion : (c.depreciacion ?? 1.0)
              } : {}),
              ...(type === 'labors' ? {
                jornal: selectedData.jornal != null ? selectedData.jornal : c.jornal,
                bono: selectedData.bono != null ? selectedData.bono : c.bono
              } : {})
            };
          }
          return c;
        });
      } else {
        const newRow = {
          id: 'SEL-' + Math.floor(Math.random() * 100000),
          codigo: selectedData.codigo || '',
          descripcion: selectedData.descripcion || '',
          cantidad: 1,
          precio_unitario: selectedData.precio_unitario || 0,
        };
        if (type === 'materials') {
          newRow.unidad = selectedData.unidad || 'und';
          newRow.desperdicio = selectedData.desperdicio != null ? selectedData.desperdicio : 5;
        } else if (type === 'equipments') {
          newRow.unidad = selectedData.unidad || 'Día';
          newRow.depreciacion = selectedData.depreciacion != null ? selectedData.depreciacion : 1.0;
        } else if (type === 'labors') {
          newRow.unidad = selectedData.unidad || 'Día';
          newRow.jornal = selectedData.jornal || 0;
          newRow.bono = selectedData.bono || 0;
        }
        updated[type] = [...(updated[type] || []), newRow];
      }
      return updated;
    });
  };

  const handleSaveAndInsert = async () => {
    if (!generator.item) return;
    setSaving(true);
    try {
      const desc = generator.item.description || generator.item.descripcion || '';
      const unit = generator.item.unit || generator.item.unidad || 'UND';
      const perf = parseFloat(generator.item.performance || generator.item.rendimiento || 1.0) || 1.0;

      if (!desc.trim()) {
        toast.error('La partida debe tener una descripción.');
        return;
      }

      // 1. Guardar copia en Base Personalizada para futuras referencias
      try {
        await saveCustomApu({
          description: desc.trim(),
          unit: unit.trim(),
          performance: perf,
          apu_data: JSON.stringify(generator.item)
        });
      } catch (saveErr) {
        console.warn('Aviso: no se pudo respaldar en base personalizada pero se agregará al presupuesto:', saveErr);
      }

      // 2. Insertar directamente al presupuesto en curso
      if (onInsertToBudget) {
        await onInsertToBudget(generator.item);
      }

      onClose();
    } catch (error) {
      console.error('Error al guardar y agregar APU al presupuesto:', error);
      toast.error('Error al agregar partida al presupuesto');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToNewGeneration = () => {
    generator.setItem(null);
    setSelectedUnit(null);
    guided.resetChatbot();
    guided.setIsGuidedMode(true);
    guided.setEntryModeSource('chat');
    guided.lastEntrySourceRef.current = 'chat';
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-5xl max-h-[92vh] bg-slate-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">
                Generar APU con Inteligencia Artificial
              </h3>
              <p className="text-xs text-slate-500 m-0">
                {generator.item
                  ? 'Revisa y ajusta el análisis de precios antes de incluirlo en el presupuesto'
                  : 'Describe la partida para estructurarla y agregarla directamente al presupuesto actual'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="overflow-y-auto p-4 sm:p-6 flex-1 bg-slate-50/50">
          {/* VISTA 1: GENERACIÓN DE APU */}
          {!generator.item && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 animate-in fade-in duration-300">
              
              {/* Tarjeta Match Exacto */}
              <ExactMatchCard
                candidate={generator.exactMatchCandidate}
                onAccept={generator.handleAcceptExactMatch}
                onReject={generator.handleRejectExactMatch}
              />

              {/* Tarjeta Aclaratoria */}
              {generator.isClarifying && (
                <ClarificationAlertCard
                  message={generator.aiClarificationMessage}
                  recommendation={generator.aiClarificationRecommendation}
                  questions={generator.aiQuestions}
                  options={generator.aiOptions}
                  entryModeSource={guided.entryModeSource}
                  onDismiss={generator.dismissClarification}
                  onClarificationSubmit={(answerText) => {
                    const combined = prompt && prompt.trim()
                      ? `${prompt.trim()}, ${answerText.trim()}`
                      : answerText.trim();
                    setPrompt(combined);
                    generator.dismissClarification();
                    generator.handleGenerate(combined, false, false, false, null, 'libre', selectedUnit);
                  }}
                  onEditOriginalPrompt={() => {
                    generator.dismissClarification();
                  }}
                  onStartGuided={() => {
                    generator.dismissClarification();
                    guided.resetChatbot();
                    guided.setIsGuidedMode(true);
                    guided.setEntryModeSource('chat');
                    guided.lastEntrySourceRef.current = 'chat';
                  }}
                  onResetChatbot={() => {
                    generator.dismissClarification();
                    guided.resetChatbot();
                    guided.setIsGuidedMode(true);
                    setPrompt('');
                    setSelectedUnit(null);
                    guided.setEntryModeSource('chat');
                    guided.lastEntrySourceRef.current = 'chat';
                  }}
                  onResetLibre={() => {
                    generator.dismissClarification();
                    guided.resetChatbot();
                    guided.setIsGuidedMode(false);
                    setPrompt('');
                    setSelectedUnit(null);
                    guided.setEntryModeSource('libre');
                    guided.lastEntrySourceRef.current = 'libre';
                  }}
                />
              )}

              {/* Chatbot Asistente Guiado */}
              {guided.isGuidedMode ? (
                <GuidedAssistantModal
                  isOpen={guided.isGuidedMode}
                  onClose={() => guided.setIsGuidedMode(false)}
                  onFinish={(finalPrompt, source, unit, executionDays) => {
                    guided.onComplete(finalPrompt, source, unit, executionDays);
                  }}
                  onSwitchToFreeMode={() => {
                    guided.setIsGuidedMode(false);
                    guided.setEntryModeSource('libre');
                    guided.lastEntrySourceRef.current = 'libre';
                  }}
                  user={user}
                  generatorLoading={generator.loading}
                  isInline={true}
                />
              ) : (
                /* Entrada de Prompt Libre */
                <div>
                  <FreeTextPromptInput
                    prompt={prompt}
                    setPrompt={setPrompt}
                    selectedUnit={selectedUnit}
                    setSelectedUnit={setSelectedUnit}
                    loading={generator.loading}
                    onSubmit={() => {
                      generator.handleGenerate(prompt, false, false, false, null, 'libre', selectedUnit);
                    }}
                    onSwitchToGuided={() => {
                      guided.setIsGuidedMode(true);
                      guided.setEntryModeSource('chat');
                      guided.lastEntrySourceRef.current = 'chat';
                    }}
                  />

                  {/* Filtro Rápido Inteligente */}
                  <SmartFilterCard
                    selectedUnit={selectedUnit}
                    setSelectedUnit={setSelectedUnit}
                    onPresetClick={(presetText) => {
                      setPrompt(presetText);
                      generator.handleGenerate(presetText, false, false, false, null, 'libre', selectedUnit);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: EDITOR Y RESULTADO DEL APU GENERADO */}
          {generator.item && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-purple-600" />
                  <h4 className="text-sm font-bold text-slate-800 m-0">
                    APU Generado listo para el presupuesto
                  </h4>
                </div>
                <button
                  onClick={handleResetToNewGeneration}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RotateCcw size={13} />
                  Generar otro
                </button>
              </div>

              {generator.item.advertencias && generator.item.advertencias.length > 0 && (
                <div className="mb-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl">
                  <h5 className="text-amber-800 text-xs font-bold mb-1">⚠️ Observaciones del Análisis</h5>
                  <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
                    {generator.item.advertencias.map((adv, idx) => (
                      <li key={idx}>{adv}</li>
                    ))}
                  </ul>
                </div>
              )}

              <ApuEditorUI
                item={generator.item}
                settings={settings}
                onHeaderChange={(field, value) => generator.setItem(prev => ({ ...prev, [field]: value }))}
                onHeaderBlur={() => {}}
                onComponentChange={handleComponentChange}
                onComponentBlur={() => {}}
                onRemoveRow={handleRemoveRow}
                onAddBlankRow={handleAddRow}
                onSelectComponent={handleSelectComponent}
                onAddSearchRow={(type, data) => handleSelectComponent(type, null, data)}
                onSettingsChange={(field, value) => {
                  setSettings(prev => ({ ...prev, [field]: value }));
                  const mapping = {
                    fcas_percent: 'fcas',
                    admin_percent: 'porcentajeAdministracion',
                    profit_percent: 'porcentajeUtilidad',
                    iva_percent: 'iva'
                  };
                  if (mapping[field]) {
                    updateCostosConfig({ [mapping[field]]: value }).catch(() => {});
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Pie del modal con botón de acción */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {generator.item && (
            <button
              onClick={handleSaveAndInsert}
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-6 py-2.5 rounded-xl transition-all shadow-md font-bold text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader className="animate-spin" size={16} /> : <Plus size={16} />}
              {saving ? 'Agregando al presupuesto...' : 'Guardar y Agregar al Presupuesto'}
            </button>
          )}
        </div>

        {/* Modal de Límite de Suscripción */}
        <SubscriptionRequestModal
          isOpen={generator.showSubscriptionModal}
          onClose={() => generator.setShowSubscriptionModal(false)}
          limitType="apu"
        />
      </div>
    </div>,
    document.body
  );
}
