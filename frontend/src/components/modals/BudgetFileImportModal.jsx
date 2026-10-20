import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { budgetService } from '../../services/budgetService';

const ACCEPTED_EXTENSIONS = '.xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp';

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'VES', label: 'VES (Bs.)' },
];

function matchLabel(score = 0) {
  if (score >= 0.75) return 'Alta';
  if (score >= 0.5) return 'Media';
  return 'Baja';
}

function fileIcon(filename = '') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return <FileText size={26} className="text-red-500" />;
  if (/\.(png|jpe?g|webp)$/.test(lower)) return <ImageIcon size={26} className="text-violet-500" />;
  return <FileSpreadsheet size={26} className="text-emerald-600" />;
}

function fileSize(bytes = 0) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BudgetFileImportModal({ isOpen, file, onClose, onCreated, onShowPlans }) {
  const [currentFile, setCurrentFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [items, setItems] = useState([]);
  const [header, setHeader] = useState({ budget_name: '', project_name: '', client_name: '', currency: 'USD' });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setCurrentFile(null);
      setPreview(null);
      setItems([]);
      setError(null);
      setLimitReached(false);
      setLoading(false);
      setCreating(false);
    } else {
      setCurrentFile(file || null);
    }
  }, [isOpen, file]);

  useEffect(() => {
    if (!isOpen || !currentFile) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setLimitReached(false);
    setPreview(null);
    setItems([]);

    (async () => {
      try {
        const data = await budgetService.previewImport(currentFile);
        if (cancelled) return;
        setPreview(data);
        setHeader({
          budget_name: data.header?.budget_name || '',
          project_name: data.header?.project_name || '',
          client_name: data.header?.client_name || '',
          currency: data.header?.currency || 'USD',
        });
        setItems((data.items || []).map((item) => ({
          ...item,
          include: true,
          quantity: item.quantity ?? 0,
          unit: item.unit || 'und',
          selected: item.is_chapter ? '' : (item.selected_cod_par || ''),
        })));
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'No se pudo analizar el archivo.');
        setLimitReached(err.status === 403);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, currentFile]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !creating) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, creating, onClose]);

  const updateItem = (index, patch) => {
    setItems((previous) => previous.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (selectedFile) {
      setCurrentFile(selectedFile);
    }
  };

  const handleGenerateApu = async (index) => {
    const item = items[index];
    if (!item || item.generating) return;

    updateItem(index, { generating: true });
    try {
      const result = await budgetService.generateImportApu({
        description: item.description,
        unit: item.unit || 'und',
        code: item.code || null,
      });
      const partida = result.partida || {};
      const generatedCode = String(partida.cod_par || `GEN-${item.code || item.row}`).trim();
      const generatedCandidate = {
        cod_par: generatedCode,
        cov_par: partida.cov_par || generatedCode,
        description: partida.description || item.description,
        unit: partida.unit || item.unit || 'und',
        score: 1,
        match_type: 'ai_generated',
      };
      updateItem(index, {
        generating: false,
        generated_data: result,
        generated_code: generatedCode,
        selected: generatedCode,
        cov_par: generatedCandidate.cov_par,
        candidates: [
          generatedCandidate,
          ...(item.candidates || []).filter((candidate) => candidate.cod_par !== generatedCode),
        ],
      });
      toast.success('APU generado con IA. Revísalo antes de crear el presupuesto.');
    } catch (err) {
      updateItem(index, { generating: false });
      toast.error(err.message || 'No se pudo generar el APU.');
    }
  };

  const includedItems = items.filter((item) => item.include && item.description.trim());
  const selectedCount = items.filter((item) => !item.is_chapter && item.selected).length;
  const pendingCount = items.filter(
    (item) => !item.is_chapter && !item.selected && (item.candidates || []).length > 0,
  ).length;
  const noMatchCount = items.filter(
    (item) => !item.is_chapter && !item.selected && (item.candidates || []).length === 0,
  ).length;

  const handleCreate = async () => {
    if (!header.budget_name.trim()) {
      toast.error('Escribe un nombre para el presupuesto.');
      return;
    }
    if (!includedItems.length) {
      toast.error('Selecciona al menos una partida para crear el presupuesto.');
      return;
    }

    setCreating(true);
    setError(null);
    setLimitReached(false);

    try {
      const result = await budgetService.commitImport({
        name: header.budget_name.trim(),
        project_name: header.project_name.trim() || null,
        client_name: header.client_name.trim() || null,
        currency: header.currency,
        source_filename: currentFile?.name || preview?.filename || null,
        items: includedItems.map((item) => {
          const generated = item.generated_data;
          const generatedCode = item.generated_code || generated?.partida?.cod_par || '';
          const useGenerated = Boolean(generated && generatedCode && item.selected === generatedCode);
          return {
            description: item.description.trim(),
            unit: (item.unit || 'und').trim() || 'und',
            quantity: Number(item.quantity) || 0,
            is_chapter: Boolean(item.is_chapter),
            cod_par: item.is_chapter ? null : (item.selected || null),
            cov_par: useGenerated ? (generated?.partida?.cov_par || generatedCode) : (item.cov_par || null),
            code: item.code || null,
            materials: useGenerated ? (generated.materials || []) : [],
            equipments: useGenerated ? (generated.equipments || []) : [],
            labors: useGenerated ? (generated.labors || []) : [],
          };
        }),
      });
      toast.success(result.message || 'Presupuesto creado correctamente.');
      if (onCreated) onCreated(result.budget_id);
    } catch (err) {
      setError(err.message || 'No se pudo crear el presupuesto.');
      if (err.status === 403) setLimitReached(true);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-0 sm:p-4">
      <div className="w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-4xl bg-amber-100 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border sm:border-amber-600/15 overflow-hidden font-sans flex flex-col">

        {/* Encabezado */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 sm:py-4 pt-safe bg-white/40 border-b border-amber-600/15 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <UploadCloud className="text-sky-600 shrink-0" size={24} />
            <div className="min-w-0">
              <h2 className="m-0 text-lg sm:text-xl font-bold text-amber-900 leading-tight truncate">
                Crear Presupuesto desde Archivo
              </h2>
              <p className="text-xs text-amber-800/80 m-0 truncate">
                Excel, CSV, PDF o imagen · las partidas se cruzan con la base maestra
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-700 hover:text-amber-900 p-2 touch-target flex items-center justify-center rounded-xl hover:bg-amber-200/50 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-4 sm:px-6 py-4 flex-1 overflow-y-auto flex flex-col gap-4">

          {/* Archivo actual */}
          {currentFile && (
            <div className="flex items-center gap-3 bg-white/70 border border-amber-600/15 rounded-xl px-3 py-2.5 shadow-sm">
              {fileIcon(currentFile.name)}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-amber-950 truncate m-0">{currentFile.name}</p>
                <p className="text-[10px] text-amber-800/70 m-0">{fileSize(currentFile.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || creating}
                className="text-[11px] font-semibold text-sky-700 hover:text-sky-800 px-2.5 py-1.5 rounded-lg hover:bg-sky-50 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw size={13} />
                Cambiar archivo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Cargando */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <Loader2 size={38} className="animate-spin text-sky-600" />
              <p className="text-sm font-bold text-amber-900 m-0">Analizando el archivo...</p>
              <p className="text-xs text-amber-800/70 m-0 max-w-sm">
                Detectando partidas y cruzando cada una con la base maestra.
                Las imágenes y PDFs escaneados se procesan con OCR; puede tardar unos segundos.
              </p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className={`border rounded-xl p-3 text-xs flex items-start gap-2 ${
              limitReached ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <AlertCircle size={16} className={`shrink-0 mt-0.5 ${limitReached ? 'text-amber-500' : 'text-red-500'}`} />
              <div className="flex-1">
                <p className="m-0">{error}</p>
                {limitReached && onShowPlans && (
                  <button
                    type="button"
                    onClick={() => { onShowPlans(); onClose(); }}
                    className="mt-2 text-[11px] font-bold text-amber-900 underline hover:no-underline"
                  >
                    Ver planes y beneficios
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Vista previa */}
          {!loading && preview && (
            <>
              {/* Datos del presupuesto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Nombre del presupuesto *</span>
                  <input
                    type="text"
                    value={header.budget_name}
                    onChange={(event) => setHeader({ ...header, budget_name: event.target.value })}
                    className="px-3 py-2 border border-sky-200 rounded-xl text-xs text-slate-800 bg-white outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-700/10"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Proyecto / Obra</span>
                  <input
                    type="text"
                    value={header.project_name}
                    onChange={(event) => setHeader({ ...header, project_name: event.target.value })}
                    className="px-3 py-2 border border-sky-200 rounded-xl text-xs text-slate-800 bg-white outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-700/10"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Cliente</span>
                    <input
                      type="text"
                      value={header.client_name}
                      onChange={(event) => setHeader({ ...header, client_name: event.target.value })}
                      className="px-3 py-2 border border-sky-200 rounded-xl text-xs text-slate-800 bg-white outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-700/10"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Moneda</span>
                    <select
                      value={header.currency}
                      onChange={(event) => setHeader({ ...header, currency: event.target.value })}
                      className="px-3 py-2 border border-sky-200 rounded-xl text-xs text-slate-800 bg-white outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-700/10"
                    >
                      {CURRENCIES.map((currency) => (
                        <option key={currency.value} value={currency.value}>{currency.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* Métricas */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/80 border border-amber-600/15 text-amber-950">
                  {preview.stats?.total || items.length} filas
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {selectedCount} con APU
                </span>
                {pendingCount > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800">
                    {pendingCount} por revisar
                  </span>
                )}
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800">
                  {noMatchCount} sin coincidencia
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/70 border border-amber-600/15 text-amber-800">
                  {preview.stats?.chapters || 0} capítulos
                </span>
                <span className="text-[10px] text-amber-800/60 ml-auto">
                  {preview.source_type === 'pdf_ocr' ? 'PDF escaneado (OCR)' :
                    preview.source_type === 'image' ? 'Imagen (OCR)' :
                      preview.source_type === 'excel' ? 'Excel' :
                        preview.source_type === 'csv' ? 'CSV' : preview.source_type}
                </span>
              </div>

              {/* Advertencias */}
              {preview.warnings?.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-300/60 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
                  {preview.warnings.map((warning, index) => (
                    <p key={index} className="m-0 flex items-start gap-1.5">
                      <Sparkles size={12} className="shrink-0 mt-0.5" />
                      <span>{warning}</span>
                    </p>
                  ))}
                </div>
              )}

              {/* Lista editable */}
              <div className="space-y-2">
                {items.map((item, index) => {
                  const selectedCandidate = (item.candidates || []).find((candidate) => candidate.cod_par === item.selected);
                  const isGenerated = selectedCandidate?.match_type === 'ai_generated';
                  const isExact = selectedCandidate && ['code', 'exact_description'].includes(selectedCandidate.match_type);
                  return (
                    <div
                      key={`${item.row}-${index}`}
                      className={`rounded-xl border p-3 transition-colors ${
                        item.include
                          ? 'bg-white/80 border-amber-600/15 shadow-sm'
                          : 'bg-white/30 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={item.include}
                          onChange={(event) => updateItem(index, { include: event.target.checked })}
                          className="mt-1 w-4 h-4 accent-sky-600 cursor-pointer shrink-0"
                          aria-label={`Incluir partida ${item.row}`}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-amber-900/60">{item.row}</span>
                            {item.is_chapter ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">Capítulo</span>
                            ) : isGenerated ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wide">
                                APU generado
                              </span>
                            ) : isExact ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                                Match exacto
                              </span>
                            ) : selectedCandidate ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                                APU sugerido
                              </span>
                            ) : (item.candidates || []).length > 0 ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
                                Por revisar
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
                                Sin coincidencia
                              </span>
                            )}
                            {item.code && (
                              <span className="text-[9px] text-slate-400 font-mono truncate">{item.code}</span>
                            )}
                          </div>

                          <input
                            type="text"
                            value={item.description}
                            onChange={(event) => updateItem(index, { description: event.target.value })}
                            className="w-full px-2 py-1.5 border border-transparent hover:border-slate-200 focus:border-sky-400 focus:bg-white rounded-lg text-xs font-medium text-slate-800 bg-transparent outline-none transition-colors"
                          />

                          {!item.is_chapter && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                              <label className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Unidad</span>
                                <input
                                  type="text"
                                  value={item.unit}
                                  onChange={(event) => updateItem(index, { unit: event.target.value })}
                                  className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] text-slate-700 bg-white outline-none focus:border-sky-400"
                                />
                              </label>
                              <label className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Cantidad</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={(event) => updateItem(index, { quantity: event.target.value })}
                                  className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] text-slate-700 bg-white outline-none focus:border-sky-400"
                                />
                              </label>
                              <label className="flex flex-col gap-0.5 col-span-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Partida de la base maestra</span>
                                <select
                                  value={item.selected || ''}
                                  onChange={(event) => updateItem(index, { selected: event.target.value })}
                                  className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] text-slate-700 bg-white outline-none focus:border-sky-400 truncate"
                                >
                                  <option value="">— Genérica (sin APU) —</option>
                                  {(item.candidates || []).map((candidate) => (
                                    <option key={candidate.cod_par} value={candidate.cod_par}>
                                      {candidate.cod_par} · {candidate.description.slice(0, 70)} ({candidate.unit || 'und'})
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}

                          {!item.is_chapter && !isExact && !isGenerated && (
                            <button
                              type="button"
                              onClick={() => handleGenerateApu(index)}
                              disabled={item.generating}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors disabled:opacity-60 disabled:cursor-wait"
                            >
                              {item.generating ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Sparkles size={13} />
                              )}
                              {item.generating ? 'Generando APU con IA...' : 'Generar APU con IA'}
                            </button>
                          )}

                          {selectedCandidate && (
                            <p className="text-[10px] text-slate-500 mt-1.5 m-0 truncate">
                              APU: <span className="font-mono font-semibold">{selectedCandidate.cov_par || selectedCandidate.cod_par}</span>
                              {' · '}{selectedCandidate.description}
                              {' · '}und: {selectedCandidate.unit || 'und'}
                              {' · '}coincidencia: {matchLabel(selectedCandidate.score)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && preview && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white/40 border-t border-amber-600/15 shrink-0 pb-safe">
            <span className="text-[11px] text-amber-800/70">
              {includedItems.length} de {items.length} filas seleccionadas
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={creating}
                className="bg-transparent border-none text-amber-700 text-xs font-semibold px-4 py-2.5 touch-target flex items-center justify-center cursor-pointer rounded-xl hover:bg-white/40 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !includedItems.length || !header.budget_name.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-[0_4px_6px_rgba(2,132,199,0.2)] hover:-translate-y-[1px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {creating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Creando presupuesto...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    Crear presupuesto
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
