import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileArchive,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { importMdbBudget, checkLocalBridge, convertWithLocalBridge } from '../services/mdbImportService.js';

const MAX_BYTES = 100 * 1024 * 1024;

export default function ImportMdbModal({ isOpen, onClose, onImported }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [bridgeStatus, setBridgeStatus] = useState('checking');

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setUploading(false);
      setError('');
      setResult(null);
      setBridgeStatus('checking');
      let active = true;
      checkLocalBridge().then((online) => {
        if (active) setBridgeStatus(online ? 'online' : 'offline');
      });
      return () => { active = false; };
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  const selectFile = (nextFile) => {
    setError('');
    setResult(null);
    if (!nextFile) return;
    const lower = nextFile.name.toLowerCase();
    if (!/\.(mdb|accdb|prx|zip)$/.test(lower)) {
      setError('Selecciona un archivo .mdb, .accdb, .prx o un ZIP de CSV.');
      return;
    }
    if (nextFile.size > MAX_BYTES) {
      setError('El archivo supera el límite de 100 MB.');
      return;
    }
    setFile(nextFile);
  };

  const submit = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    try {
      let uploadFile = file;
      const isZip = /\.zip$/i.test(file.name);
      if (!isZip && bridgeStatus === 'online') {
        const zipBlob = await convertWithLocalBridge(file);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        uploadFile = new File([zipBlob], `${baseName}_csv.zip`, {
          type: 'application/zip',
        });
      }
      const data = await importMdbBudget(uploadFile);
      setResult(data);
    } catch (err) {
      setError(err.message || 'No se pudo importar el archivo.');
    } finally {
      setUploading(false);
    }
  };

  const openBudget = () => {
    if (result?.budget_id && onImported) {
      onImported(result);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-600/20 bg-amber-100 font-sans shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <header className="flex items-center justify-between border-b border-amber-600/15 bg-amber-100/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-950">Importar presupuesto MDB</h2>
              <p className="text-xs text-amber-800">Transforma un proyecto desde base de datos (.mdb) en un presupuesto de Kosto.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-full p-1.5 text-amber-800 hover:bg-amber-200/70 hover:text-amber-950 disabled:opacity-40 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5">
          {!result && (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition-colors ${
                  file
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-amber-400/70 bg-white/80 hover:border-amber-500 hover:bg-amber-50/90'
                }`}
              >
                <FileArchive className={`h-10 w-10 ${file ? 'text-amber-600' : 'text-amber-500/80'}`} />
                <p className="mt-3 text-sm font-bold text-amber-950">
                  {file ? file.name : 'Selecciona el archivo de base de datos'}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                    : 'Formatos: .mdb, .accdb, .prx o ZIP de CSV · máximo 100 MB'}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs">
                  <Upload className="h-3.5 w-3.5" /> Elegir archivo
                </span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".mdb,.accdb,.prx,.zip"
                className="hidden"
                onChange={(e) => selectFile(e.target.files?.[0] || null)}
              />

              <div className={`rounded-2xl border px-4 py-3 text-xs ${
                bridgeStatus === 'online'
                  ? 'border-emerald-300 bg-emerald-50/95 text-emerald-950'
                  : 'border-amber-300 bg-white/80 text-amber-950'
              }`}>
                <p className="flex items-center gap-2 font-bold">
                  <span className={`h-2 w-2 rounded-full ${
                    bridgeStatus === 'online'
                      ? 'bg-emerald-500'
                      : bridgeStatus === 'checking'
                        ? 'animate-pulse bg-amber-500'
                        : 'bg-amber-400'
                  }`} />
                  {bridgeStatus === 'online'
                    ? 'Puente local conectado'
                    : bridgeStatus === 'checking'
                      ? 'Buscando puente local...'
                      : 'Puente local no detectado'}
                </p>
                <p className="mt-1 text-amber-900/90">
                  {bridgeStatus === 'online'
                    ? 'El .mdb se convierte en tu equipo y luego se sube a Kosto.'
                    : 'Para formatos antiguos instala el puente local o usa el exportador manual.'}
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <a
                    href="/tools/Instalador_Puente_CostBase.zip"
                    download
                    className="font-bold text-amber-800 underline underline-offset-2 hover:text-amber-950"
                  >
                    Instalar puente local (.zip)
                  </a>
                  <a
                    href="/tools/Exportador_MDB_Windows.zip"
                    download
                    className="font-bold text-amber-800 underline underline-offset-2 hover:text-amber-950"
                  >
                    Exportador manual (.zip)
                  </a>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Presupuesto importado</p>
                  <p className="text-xs text-emerald-800">{result.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Partidas', result.items],
                  ['Materiales', result.materials],
                  ['Equipos', result.equipments],
                  ['Mano de obra', result.labors],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-amber-300/80 bg-white/90 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">{label}</p>
                    <p className="text-lg font-extrabold text-amber-950">{value ?? 0}</p>
                  </div>
                ))}
              </div>

              {result.warnings?.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  <p className="font-bold">Advertencias</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {result.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-amber-600/15 bg-amber-100/80 px-5 py-4">
          {!result ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50 disabled:opacity-40 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!file || uploading || bridgeStatus === 'checking'}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-40 cursor-pointer"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {uploading ? 'Importando...' : 'Importar a Kosto'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={openBudget}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 cursor-pointer"
              >
                Abrir presupuesto
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
