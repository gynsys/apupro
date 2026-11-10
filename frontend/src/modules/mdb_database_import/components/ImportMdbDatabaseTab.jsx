import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileArchive,
  Layers,
  Wrench,
  Users,
  Package,
  HardDriveDownload,
  Info,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { importMdbDatabase, checkLocalBridge } from '../services/mdbDatabaseImportService';

const MAX_BYTES = 150 * 1024 * 1024; // 150 MB

export default function ImportMdbDatabaseTab({ onSuccess, onClose }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dbName, setDbName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [bridgeStatus, setBridgeStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    let active = true;
    checkLocalBridge().then((online) => {
      if (active) setBridgeStatus(online ? 'online' : 'offline');
    });
    return () => {
      active = false;
    };
  }, []);

  const handleFileSelect = (selectedFile) => {
    setError('');
    setImportResult(null);
    if (!selectedFile) return;

    const lower = selectedFile.name.toLowerCase();
    if (!/\.(mdb|accdb|prx|zip)$/.test(lower)) {
      setError('Selecciona un archivo válido de Access (.mdb, .accdb, .prx) o un ZIP de CSVs.');
      return;
    }
    if (selectedFile.size > MAX_BYTES) {
      setError('El archivo supera el límite de 150 MB.');
      return;
    }

    setFile(selectedFile);
    // Sugerir nombre legible si aún está vacío
    if (!dbName) {
      const cleanStem = selectedFile.name
        .replace(/\.[^.]+$/, '')
        .replace(/_/g, ' ')
        .replace(/bdd|maprex|base/gi, '')
        .trim();
      setDbName(cleanStem ? `Base ${cleanStem.charAt(0).toUpperCase() + cleanStem.slice(1)}` : 'Base Maprex');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Por favor selecciona un archivo MDB o ZIP.');
      return;
    }
    if (!dbName.trim()) {
      setError('El nombre de la base de datos es obligatorio.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await importMdbDatabase(file, dbName, description, isPublished);
      setImportResult(result);
      toast.success(result.message || 'Base de datos creada exitosamente');
      if (typeof onSuccess === 'function') {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Error importando base de datos Maprex:', err);
      setError(err.message || 'Ocurrió un error al procesar el archivo Maprex.');
      toast.error(err.message || 'Error en la importación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-1 text-slate-800">
      {/* Estado Éxito */}
      {importResult ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center bg-white rounded-2xl border border-emerald-200 shadow-sm animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-inner">
            <CheckCircle2 size={36} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-1">¡Base de Datos Importada con Éxito!</h3>
          <p className="text-sm text-slate-600 mb-6 max-w-md">
            Se ha creado el esquema aislado <strong>{importResult.database?.id}</strong> con todos los insumos, análisis y recetas APU listos para contraste y cotización.
          </p>

          {/* Grilla de Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg mb-6">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">Partidas</span>
              <span className="text-lg font-extrabold text-blue-600">
                {(importResult.counts?.items || 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">Materiales</span>
              <span className="text-lg font-extrabold text-emerald-600">
                {(importResult.counts?.materials || 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">Equipos</span>
              <span className="text-lg font-extrabold text-amber-600">
                {(importResult.counts?.equipment || 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">Mano de Obra</span>
              <span className="text-lg font-extrabold text-violet-600">
                {(importResult.counts?.labor || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all active:scale-95"
            >
              Cerrar y Ver Bases de Datos
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Zona de Arrastre de Archivo */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              file
                ? 'border-indigo-400 bg-indigo-50/50'
                : 'border-slate-300 hover:border-indigo-500 bg-slate-50/70 hover:bg-white'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mdb,.accdb,.prx,.zip"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center gap-3 text-left w-full max-w-sm">
                <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-sm flex-shrink-0">
                  <Database size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Listo para procesar
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-1"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2 shadow-inner">
                  <Upload size={24} />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Arrastra tu archivo Maprex o haz clic aquí
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Formatos soportados: <strong>.MDB, .ACCDB, .PRX o .ZIP</strong> (Hasta 150 MB)
                </p>
              </>
            )}
          </div>

          {/* Información del Puente Local */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-100/80 rounded-xl text-xs text-slate-600 border border-slate-200">
            <span className="flex items-center gap-1.5 font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  bridgeStatus === 'online'
                    ? 'bg-emerald-500 animate-pulse'
                    : bridgeStatus === 'checking'
                    ? 'bg-amber-400'
                    : 'bg-slate-400'
                }`}
              />
              Puente Windows: {bridgeStatus === 'online' ? 'Conectado (Access 97-2024 soportado)' : 'Modo Servidor Directo'}
            </span>
            <a
              href="/tools/Exportador_MDB_Windows.zip"
              download
              className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
              title="Descargar script Windows para exportar MDBs antiguos a ZIP"
            >
              Descargar Exportador ZIP
            </a>
          </div>

          {/* Campos del Formulario */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[13px] font-semibold text-slate-800 block mb-1">
                Nombre de la Base de Datos <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                placeholder="Ej. Base Maprex Junio 2026 - Dólares"
                required
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm text-slate-800 bg-white outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all"
              />
            </div>

            <div>
              <label className="text-[13px] font-semibold text-slate-800 block mb-1">
                Descripción (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Catálogo oficial de costos y análisis APU importado desde Maprex"
                rows={2}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm text-slate-800 bg-white outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all resize-none"
              />
            </div>

            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="is_published_db"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="is_published_db" className="text-xs text-slate-700 font-medium cursor-pointer select-none">
                Publicar base de datos inmediatamente (disponible para todos los usuarios)
              </label>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Botón de Envío */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200/80">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-800 bg-transparent transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!file || !dbName.trim() || loading}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white shadow-md transition-all ${
                !file || !dbName.trim() || loading
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Procesando Base de Datos...</span>
                </>
              ) : (
                <>
                  <Database size={18} />
                  <span>Crear Base de Datos</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
