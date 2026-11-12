import React, { useState } from 'react';
import {
  FiBookOpen,
  FiCheckCircle,
  FiDollarSign,
  FiFileText,
  FiInfo,
  FiX,
} from 'react-icons/fi';
import { getPartidaDocumentacion } from '../../data/partidaDocumentacion';

const TABS = [
  { id: 'medicion', label: 'Medición', icon: FiBookOpen },
  { id: 'pago', label: 'Pago', icon: FiDollarSign },
  { id: 'fuente', label: 'Fuente', icon: FiFileText },
];

const ListBlock = ({ title, items, tone = 'slate' }) => {
  if (!items?.length) return null;
  const color = tone === 'green' ? 'text-emerald-700' : 'text-rose-700';
  const bullet = tone === 'green' ? 'bg-emerald-500' : 'bg-rose-500';

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${bullet}`} />
            <span className={color}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function PartidaMedicionModal({ item, onClose }) {
  const [tab, setTab] = useState('medicion');
  if (!item) return null;

  const doc = getPartidaDocumentacion(item);
  const codigo = item.CovPar || item.CodPar || 'Sin código';

  return (
    <div
      className="fixed inset-0 z-[999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="partida-medicion-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up"
      >
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                <FiBookOpen size={16} />
              </span>
              <h3 id="partida-medicion-title" className="font-bold text-slate-800 text-base">
                Medición y pago
              </h3>
            </div>
            <p className="text-xs font-mono font-bold text-blue-700">{codigo}</p>
            <p className="text-sm text-slate-600 line-clamp-2 mt-0.5">
              {item.Descri || 'Sin descripción'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-white transition"
            aria-label="Cerrar"
          >
            <FiX size={20} />
          </button>
        </div>

        {!doc ? (
          <div className="p-8 text-center">
            <FiInfo size={30} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">Sin documentación registrada</p>
            <p className="text-xs text-slate-500 mt-1">
              No hay una ficha de medición para el capítulo de esta partida.
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 pt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-semibold">
                <FiCheckCircle size={12} />
                {doc.inheritedLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                <FiFileText size={12} />
                {doc.source} · {doc.pages}
              </span>
            </div>

            <div className="px-6 pt-3">
              <div className="flex gap-1 border-b border-slate-100">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition ${
                      tab === id
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              {tab === 'medicion' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Alcance
                    </p>
                    <p className="text-sm leading-relaxed text-slate-700">{doc.alcance}</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1.5">
                      Criterio de medición
                    </p>
                    <p className="text-sm leading-relaxed text-slate-700">{doc.medicion}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ListBlock title="Incluye" items={doc.inclusiones} tone="green" />
                    <ListBlock title="No incluye" items={doc.exclusiones} tone="rose" />
                  </div>
                </div>
              )}

              {tab === 'pago' && (
                <div className="space-y-4">
                  {/* Bloque 1: Hito de Reconocimiento y Liquidación */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="p-1 rounded-md bg-emerald-200 text-emerald-800">
                        <FiCheckCircle size={14} />
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                          Forma de pago
                        </p>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                          Hito de reconocimiento (COVENIN Art. 2.7)
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-emerald-950 leading-relaxed">
                      {typeof doc.pago === 'object' ? doc.pago.hito : doc.pago}
                    </p>
                    {typeof doc.pago === 'object' && doc.pago.criterio && (
                      <p className="text-xs text-emerald-800 mt-2.5 pt-2.5 border-t border-emerald-200/70 leading-relaxed">
                        <strong className="text-emerald-900">Base de liquidación:</strong> {doc.pago.criterio}
                      </p>
                    )}
                  </div>

                  {/* Bloque 2: Inclusiones en el Precio Unitario (APU) */}
                  {typeof doc.pago === 'object' && doc.pago.inclusiones?.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Inclusiones en el precio unitario (No cobrables por separado)
                      </p>
                      <ul className="space-y-1.5">
                        {doc.pago.inclusiones.map((inc) => (
                          <li key={inc} className="flex items-start gap-2 text-xs text-slate-700">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                            <span>{inc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bloque 3: Condiciones y Marco Contractual */}
                  <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/80 border border-amber-200 p-4">
                    <FiInfo className="text-amber-700 shrink-0 mt-0.5" size={16} />
                    <div className="text-xs leading-relaxed text-amber-900">
                      <p className="font-semibold mb-0.5">Condiciones contractuales y control de valuación:</p>
                      <p>
                        {typeof doc.pago === 'object' && doc.pago.condiciones
                          ? doc.pago.condiciones
                          : 'La norma COVENIN regula el criterio de medición y los hitos técnicos de ejecución. Las condiciones contractuales de pago (anticipos, valuaciones periódicas y retenciones de fiel cumplimiento) se rigen por las Condiciones Generales de Contratación vigentes.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'fuente' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Norma de referencia
                    </p>
                    <p className="text-sm font-semibold text-slate-800">{doc.source}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Sector construcción. Mediciones y codificación de partidas para
                      estudios, proyectos y construcción. Parte 2: Edificaciones.
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Ubicación: {doc.pages}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    La documentación se organiza por capítulo y subcapítulo. Esta
                    partida hereda la ficha correspondiente a su código.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
