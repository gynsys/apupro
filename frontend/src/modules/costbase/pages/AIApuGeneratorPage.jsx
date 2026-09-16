import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader, Save, Calculator, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { AuthContext } from '../../../context/AuthContext';
import { useUserCostos } from '../../../context/UserCostosContext';
import { saveCustomApu, fetchApuDetails } from '../services/cost360Service';
import { cost360DatabaseService } from '../../../services/cost360DatabaseService';
import { useCost360Search } from '../hooks/useCost360Search';

import ApuEditorUI from '../../../components/ApuEditorUI';
import ExportApuExcelButton from '../components/ExportApuExcelButton';
import PrintAPUModal from '../../../components/PrintAPUModal';
import PrintAPULayout from '../../../components/PrintAPULayout';
import SubscriptionRequestModal from '../../../components/SubscriptionRequestModal';

import ApuGeneratorHeader from '../components/ai-generator/ApuGeneratorHeader';
import ExactMatchCard from '../components/ai-generator/ExactMatchCard';
import ClarificationAlertCard from '../components/ai-generator/ClarificationAlertCard';
import GuidedAssistantModal from '../components/ai-generator/GuidedAssistantModal';
import FreeTextPromptInput from '../components/ai-generator/FreeTextPromptInput';
import SmartFilterCard from '../components/ai-generator/SmartFilterCard';
import ImportFromDbPanel from '../components/ai-generator/ImportFromDbPanel';

import { useGuidedAssistant } from '../hooks/useGuidedAssistant';
import { useApuGenerator } from '../hooks/useApuGenerator';

export default function AIApuGeneratorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  const guidedParam = searchParams.get('guided');

  const { user } = useContext(AuthContext);
  const { costosConfig, updateCostosConfig } = useUserCostos();

  const [creationMode, setCreationMode] = useState(modeParam || 'ia');
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState('master');

  // Print state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState(null);

  // Settings de costos
  const [settings, setSettings] = useState(() => ({
    fcas_percent: costosConfig?.fcas ?? 417,
    admin_percent: costosConfig?.porcentajeAdministracion ?? 15.0,
    profit_percent: costosConfig?.porcentajeUtilidad ?? 10.0,
    iva_percent: 0,
    labor_bonus: 0,
    currency: 'USD'
  }));

  useEffect(() => {
    if (costosConfig) {
      setSettings(prev => ({
        ...prev,
        fcas_percent: costosConfig.fcas ?? prev.fcas_percent,
        admin_percent: costosConfig.porcentajeAdministracion ?? prev.admin_percent,
        profit_percent: costosConfig.porcentajeUtilidad ?? prev.profit_percent,
      }));
    }
  }, [costosConfig]);

  // Hook generador de APU con IA
  const generator = useApuGenerator({ setSettings });

  // Hook del asistente guiado (chatbot)
  const guided = useGuidedAssistant({
    user,
    initialGuided: guidedParam !== null ? guidedParam === 'true' : true,
    onComplete: (finalPrompt, source) => {
      setPrompt(finalPrompt);
      generator.handleGenerate(finalPrompt, false, false, false, null, source);
    }
  });

  // Hook de búsqueda en bases de datos para modo importación
  const searchProps = useCost360Search({
    databaseId: selectedDatabase,
    onlyCoded: true,
    limit: 50,
    autoSearch: creationMode === 'import'
  });

  // Cargar bases de datos disponibles
  useEffect(() => {
    const loadDatabases = async () => {
      try {
        const dbs = await cost360DatabaseService.getAll();
        const loadedDbs = dbs.databases || [];
        if (!loadedDbs.find(db => db.id === 'personalizada')) {
          loadedDbs.push({ id: 'personalizada', name: 'Base Personalizada', is_master: false });
        }
        setDatabases(loadedDbs);
      } catch (err) {
        console.error('Error loading databases', err);
      }
    };
    loadDatabases();
  }, []);

  // Manejo de eventos afterprint
  useEffect(() => {
    if (printOptions) {
      const handleAfterPrint = () => {
        setPrintOptions(null);
        setPrintModalOpen(false);
      };
      window.addEventListener('afterprint', handleAfterPrint);
      setTimeout(() => {
        window.print();
      }, 300);
      return () => window.removeEventListener('afterprint', handleAfterPrint);
    }
  }, [printOptions]);

  // Manejo de parámetros de URL para sincronizar modos
  useEffect(() => {
    if (modeParam === 'manual') {
      setCreationMode('manual');
      handleCreateManual();
    } else if (modeParam === 'import') {
      setCreationMode('import');
      generator.setItem(null);
    } else if (modeParam === 'ia') {
      setCreationMode('ia');
    }
  }, [modeParam]);

  useEffect(() => {
    if (guidedParam === 'false') {
      guided.setIsGuidedMode(false);
      guided.setEntryModeSource('libre');
      guided.lastEntrySourceRef.current = 'libre';
    } else if (guidedParam === 'true') {
      guided.setIsGuidedMode(true);
      guided.setEntryModeSource('chat');
      guided.lastEntrySourceRef.current = 'chat';
    }
  }, [guidedParam]);

  const handleCreateManual = () => {
    setSettings(prev => ({ ...prev, iva_percent: 0 }));
    generator.setItem({
      cod_par: 'CUST-' + Math.floor(Math.random() * 10000),
      description: 'Nueva Partida Personalizada',
      unit: 'und',
      performance: 1,
      materials: [],
      equipments: [],
      labors: [],
      advertencias: []
    });
  };

  const handleImportApu = async (itemCode) => {
    try {
      generator.setItem(null);
      const data = await fetchApuDetails(itemCode, selectedDatabase);
      guided.setIsGuidedMode(false);
      setSettings(prev => ({ ...prev, iva_percent: 0 }));
      generator.setItem({
        cod_par: data.partida.CodPar,
        description: data.partida.Descri,
        unit: data.partida.UniPar,
        performance: data.partida.RenPar || 1,
        materials: (data.materiales || []).map(m => ({
          id: m.codigo,
          codigo: m.codigo,
          descripcion: m.descripcion,
          unidad: m.unidad,
          cantidad: m.cantidad,
          precio_unitario: m.precio_unitario,
          desperdicio: m.desperdicio || 5,
          origen: 'historico'
        })),
        equipments: (data.equipos || []).map(e => ({
          id: e.codigo,
          codigo: e.codigo,
          descripcion: e.descripcion,
          unidad: 'día',
          cantidad: e.cantidad,
          precio_unitario: e.precio_unitario,
          depreciacion: e.depreciacion || 1.0,
          origen: 'historico'
        })),
        labors: (data.mano_obra || []).map(l => ({
          id: l.codigo,
          codigo: l.codigo,
          descripcion: l.descripcion,
          unidad: 'día',
          cantidad: l.cantidad,
          jornal: l.jornal,
          bono: l.bono,
          origen: 'historico'
        })),
        advertencias: []
      });
      toast.success('APU importado correctamente. Ahora puedes editarlo.');
      searchProps.setSearchQuery('');
    } catch (err) {
      console.error(err);
      toast.error('Error importando APU');
    }
  };

  const handleSave = async () => {
    if (!generator.item) return;
    setSaving(true);
    try {
      await saveCustomApu({
        description: generator.item.description,
        unit: generator.item.unit,
        performance: generator.item.performance,
        apu_data: JSON.stringify(generator.item)
      });
      toast.success('APU guardado exitosamente');
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar APU');
    } finally {
      setSaving(false);
    }
  };

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

  const handleBackNavigation = () => {
    if (generator.item) {
      generator.setItem(null);
      if (creationMode === 'import') {
        navigate('/cost360/ai-generator?mode=import');
      } else if (creationMode === 'manual') {
        navigate('/cost360/ai-generator?mode=manual');
      } else if (creationMode === 'ia') {
        const targetSource = guided.lastEntrySourceRef.current || guided.entryModeSource;
        if (targetSource === 'libre') {
          guided.setIsGuidedMode(false);
          guided.setEntryModeSource('libre');
          guided.lastEntrySourceRef.current = 'libre';
          navigate('/cost360/ai-generator?mode=ia&guided=false');
        } else {
          guided.setIsGuidedMode(true);
          guided.setEntryModeSource('chat');
          guided.lastEntrySourceRef.current = 'chat';
          navigate('/cost360/ai-generator?mode=ia&guided=true');
        }
      }
    } else {
      navigate('/cost360');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-24">
      {/* CABECERA Y TOOLBAR */}
      <ApuGeneratorHeader
        creationMode={creationMode}
        item={generator.item}
        onBack={handleBackNavigation}
      />

      {/* PANEL DE IMPORTACIÓN DESDE BD */}
      {creationMode === 'import' && !generator.item && (
        <ImportFromDbPanel
          selectedDatabase={selectedDatabase}
          setSelectedDatabase={setSelectedDatabase}
          databases={databases}
          searchProps={searchProps}
          totalMatches={searchProps.totalResults}
          searchResults={searchProps.results}
          onImportApu={handleImportApu}
        />
      )}

      {/* GENERADOR CON IA */}
      {creationMode === 'ia' && !generator.item && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* TARJETA MATCH EXACTO */}
          <ExactMatchCard
            candidate={generator.exactMatchCandidate}
            onAccept={generator.handleAcceptExactMatch}
            onReject={generator.handleRejectExactMatch}
          />

          {/* TARJETA ÁMBAR DE ACLARATORIA */}
          {generator.isClarifying && (
            <ClarificationAlertCard
              message={generator.aiClarificationMessage}
              recommendation={generator.aiClarificationRecommendation}
              questions={generator.aiQuestions}
              entryModeSource={guided.entryModeSource}
              onDismiss={generator.dismissClarification}
              onStartGuided={() => {
                generator.dismissClarification();
                guided.resetChatbot();
                guided.setIsGuidedMode(true);
                guided.setEntryModeSource('chat');
                guided.lastEntrySourceRef.current = 'chat';
                navigate('/cost360/ai-generator?mode=ia&guided=true', { replace: true });
              }}
              onResetChatbot={() => {
                generator.dismissClarification();
                guided.resetChatbot();
                guided.setIsGuidedMode(true);
                setPrompt('');
                guided.setEntryModeSource('chat');
                guided.lastEntrySourceRef.current = 'chat';
                navigate('/cost360/ai-generator?mode=ia&guided=true', { replace: true });
              }}
              onResetLibre={() => {
                generator.dismissClarification();
                guided.setIsGuidedMode(false);
                setPrompt('');
                guided.setEntryModeSource('libre');
                guided.lastEntrySourceRef.current = 'libre';
                navigate('/cost360/ai-generator?mode=ia&guided=false', { replace: true });
              }}
            />
          )}

          {/* MODAL DEL ASISTENTE GUIADO (CHATBOT) */}
          {guided.isGuidedMode && !generator.isClarifying && !generator.item && (
            <GuidedAssistantModal
              isOpen={guided.isGuidedMode}
              onClose={() => {
                guided.setIsGuidedMode(false);
                guided.setEntryModeSource('libre');
                guided.lastEntrySourceRef.current = 'libre';
                navigate('/cost360/ai-generator?mode=ia&guided=false', { replace: true });
              }}
              currentChatStep={guided.currentChatStep}
              guidedMessages={guided.guidedMessages}
              guidedAccion={guided.guidedAccion}
              guidedMaterial={guided.guidedMaterial}
              chatbotLoadingStage={guided.chatbotLoadingStage}
              chatInputValue={guided.chatInputValue}
              setChatInputValue={guided.setChatInputValue}
              handleChatSubmit={guided.handleChatSubmit}
              handleGoBack={guided.handleGoBack}
              onSwitchToFreeText={() => {
                guided.setIsGuidedMode(false);
                guided.setEntryModeSource('libre');
                guided.lastEntrySourceRef.current = 'libre';
                navigate('/cost360/ai-generator?mode=ia&guided=false', { replace: true });
              }}
            />
          )}

          {/* INPUT DE TEXTO LIBRE Y BOTÓN GENERAR */}
          <FreeTextPromptInput
            prompt={prompt}
            setPrompt={setPrompt}
            isGuidedMode={guided.isGuidedMode}
            isSmartMode={false}
            isClarifying={generator.isClarifying}
            loading={generator.loading}
            exactMatchCandidate={generator.exactMatchCandidate}
            subscriptionErrorMsg={generator.subscriptionErrorMsg}
            onOpenSubscriptionModal={() => generator.setShowSubscriptionModal(true)}
            onGenerate={(text) => generator.handleGenerate(text, false, false, false, null, 'libre')}
            onSwitchToGuided={() => {
              guided.resetChatbot();
              guided.setIsGuidedMode(true);
              guided.setEntryModeSource('chat');
              guided.lastEntrySourceRef.current = 'chat';
              setPrompt('');
              navigate('/cost360/ai-generator?mode=ia&guided=true', { replace: true });
            }}
            onSwitchToLibre={() => {
              guided.setIsGuidedMode(false);
              guided.setEntryModeSource('libre');
              guided.lastEntrySourceRef.current = 'libre';
              navigate('/cost360/ai-generator?mode=ia&guided=false', { replace: true });
            }}
          />
        </div>
      )}

      {/* IMPRESIÓN DE APU */}
      {printOptions && generator.item && (
        <PrintAPULayout 
          partida={generator.item} 
          materiales={generator.item.materials || []} 
          equipos={generator.item.equipments || []} 
          mano_obra={generator.item.labors || []} 
          options={{ ...settings, ...printOptions }} 
        />
      )}
      
      {printModalOpen && (
        <PrintAPUModal 
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)} 
          onPrint={(options) => setPrintOptions(options)} 
        />
      )}

      {/* EDITOR DE APU (CUANDO SE HA GENERADO O IMPORTADO UN ITEM) */}
      {generator.item && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calculator size={20} className="text-blue-500" />
                APU EN EDICIÓN
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPrintModalOpen(true)}
                className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 hover:border-blue-400 hover:shadow-md transition-all duration-200 shadow-sm cursor-pointer"
                title="Imprimir"
              >
                <Printer size={20} />
              </button>
              <ExportApuExcelButton
                item={generator.item}
                settings={settings}
              />
            </div>
          </div>
          
          {generator.item.advertencias && generator.item.advertencias.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl shadow-sm">
              <h4 className="text-amber-800 font-bold mb-2 flex items-center gap-2">⚠️ Advertencias del Análisis</h4>
              <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
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

          {/* BOTÓN GUARDAR APU */}
          <div className="flex justify-end pt-6 border-t border-slate-200 mt-6">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow font-bold disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
              {saving ? 'Guardando...' : 'Guardar APU Generado'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE SOLICITUD DE SUSCRIPCIÓN / PLANES */}
      <SubscriptionRequestModal
        isOpen={generator.showSubscriptionModal}
        onClose={() => generator.setShowSubscriptionModal(false)}
        limitType="apu"
      />
    </div>
  );
}
