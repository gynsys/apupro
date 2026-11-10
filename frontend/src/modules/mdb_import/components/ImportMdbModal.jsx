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
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Importar presupuesto MDB</h2>
              <p className="text-xs text-slate-500">Transforma un proyecto Maprex/Lulo en un presupuesto Costbase.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40"
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
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50'
                }`}
              >
                <FileArchive className={`h-10 w-10 ${file ? 'text-indigo-600' : 'text-slate-400'}`} />
                <p className="mt-3 text-sm font-bold text-slate-800">
                  {file ? file.name : 'Selecciona el archivo de Access'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                    : 'Formatos: .mdb, .accdb, .prx o ZIP de CSV · máximo 100 MB'}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200">
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

              <div className={`rounded-xl border px-4 py-3 text-xs ${
                bridgeStatus === 'online'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}>
                <p className="flex items-center gap-2 font-bold">
                  <span className={`h-2 w-2 rounded-full ${
                    bridgeStatus === 'online'
                      ? 'bg-emerald-500'
                      : bridgeStatus === 'checking'
                        ? 'animate-pulse bg-amber-500'
                        : 'bg-slate-400'
                  }`} />
                  {bridgeStatus === 'online'
                    ? 'Puente local conectado'
                    : bridgeStatus === 'checking'
                      ? 'Buscando puente local...'
                      : 'Puente local no detectado'}
                </p>
                <p className="mt-1">
                  {bridgeStatus === 'online'
                    ? 'El .mdb se convierte en tu laptop y luego se sube a Costbase.'
                    : 'Para Access 1.0/2.0 instala el puente local o usa el exportador manual.'}
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <a
                    href="/tools/Instalador_Puente_CostBase.zip"
                    download
                    className="font-bold text-indigo-700 underline underline-offset-2"
                  >
                    Instalar puente local (.zip)
                  </a>
                  <a
                    href="/tools/Exportador_MDB_Windows.zip"
                    download
                    className="font-bold text-indigo-700 underline underline-offset-2"
                  >
                    Exportador manual (.zip)
                  </a>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
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
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="text-lg font-extrabold text-slate-900">{value ?? 0}</p>
                  </div>
                ))}
              </div>

              {result.warnings?.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
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

        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          {!result ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!file || uploading || bridgeStatus === 'checking'}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {uploading ? 'Importando...' : 'Importar a Costbase'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={openBudget}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
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
