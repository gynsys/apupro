import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  X, Search, ArrowLeft, HelpCircle, FolderPlus, CloudDownload,
  Share2, Database, Cpu, Settings, Calculator, ChevronDown,
  Clock, Sparkles, BookOpen, Lightbulb, CheckCircle2
} from 'lucide-react';
import {
  HELP_CATEGORIES,
  HELP_ARTICLES,
  HELP_FAQS,
  CONTEXTUAL_SUGGESTIONS
} from '../../data/helpData';

const ICON_MAP = {
  FolderPlus,
  CloudDownload,
  Share2,
  Database,
  Cpu,
  Settings,
  Calculator,
  BookOpen
};

export default function HelpDrawer({ isOpen, onClose }) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Cerrar al pulsar Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedArticle) {
          setSelectedArticle(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedArticle, onClose]);

  // Resetear estados al cerrar
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedCategory('all');
      setSelectedArticle(null);
      setExpandedFaq(null);
    }
  }, [isOpen]);

  // Obtener sugerencias contextuales según la ruta actual
  const contextualArticles = useMemo(() => {
    const path = location.pathname;
    let matchingIds = [];

    if (path.startsWith('/budgets')) {
      matchingIds = CONTEXTUAL_SUGGESTIONS['/budgets'] || [];
    } else if (path.startsWith('/cost360/databases')) {
      matchingIds = CONTEXTUAL_SUGGESTIONS['/cost360/databases'] || [];
    } else if (path.startsWith('/cost360/ai-generator')) {
      matchingIds = CONTEXTUAL_SUGGESTIONS['/cost360/ai-generator'] || [];
    } else if (path.startsWith('/cost360')) {
      matchingIds = CONTEXTUAL_SUGGESTIONS['/cost360'] || [];
    } else if (path.startsWith('/fcas')) {
      matchingIds = CONTEXTUAL_SUGGESTIONS['/fcas'] || [];
    }

    return HELP_ARTICLES.filter((art) => matchingIds.includes(art.id));
  }, [location.pathname]);

  // Filtrado de artículos
  const filteredArticles = useMemo(() => {
    let list = HELP_ARTICLES;

    if (selectedCategory !== 'all' && selectedCategory !== 'faq') {
      list = list.filter((a) => a.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.shortDesc.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)) ||
          a.steps.some(
            (s) =>
              s.title.toLowerCase().includes(q) ||
              s.desc.toLowerCase().includes(q)
          )
      );
    }

    return list;
  }, [searchQuery, selectedCategory]);

  // Filtrado de FAQs
  const filteredFaqs = useMemo(() => {
    if (selectedCategory !== 'all' && selectedCategory !== 'faq') {
      return [];
    }

    let list = HELP_FAQS;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.q.toLowerCase().includes(q) ||
          f.a.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [searchQuery, selectedCategory]);

  const toggleFaq = (id) => {
    setExpandedFaq((prev) => (prev === id ? null : id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside
          className="w-screen max-w-md md:max-w-lg bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out border-l border-slate-200"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <HelpCircle size={22} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
                  Centro de Ayuda
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Guías, tutoriales y preguntas frecuentes
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Cerrar (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {selectedArticle ? (
              /* VISTA DE ARTÍCULO DETALLADO */
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors py-1 px-2.5 rounded-lg bg-blue-50/70 hover:bg-blue-100 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Volver a las guías</span>
                </button>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-blue-100 text-blue-800">
                      {selectedArticle.badge}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock size={12} /> {selectedArticle.time}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      Nivel {selectedArticle.level}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
                    {selectedArticle.title}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1.5">
                    {selectedArticle.shortDesc}
                  </p>
                </div>

                {/* Pasos */}
                <div className="space-y-3.5 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Pasos a seguir
                  </h4>
                  {selectedArticle.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1 text-xs leading-relaxed">
                        <p className="font-bold text-slate-800 mb-0.5">
                          {step.title}
                        </p>
                        <p className="text-slate-600">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Consejos */}
                {selectedArticle.tips && selectedArticle.tips.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200/80 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <Lightbulb size={16} className="text-amber-600" />
                      <span>Consejos útiles</span>
                    </div>
                    <ul className="text-xs text-amber-950/90 space-y-1.5 pl-5 list-disc">
                      {selectedArticle.tips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              /* VISTA PRINCIPAL DEL CENTRO DE AYUDA */
              <>
                {/* Search Bar */}
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar guías, preguntas o atajos..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2 text-xs md:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Sugerencias contextuales según la pantalla actual */}
                {!searchQuery && contextualArticles.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/40 border border-blue-100/90 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                      <Sparkles size={15} className="text-blue-600" />
                      <span>Recomendado para esta pantalla</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {contextualArticles.map((art) => {
                        const IconComponent = ICON_MAP[art.icon] || BookOpen;
                        return (
                          <button
                            key={art.id}
                            onClick={() => setSelectedArticle(art)}
                            className="w-full text-left p-2.5 bg-white/95 hover:bg-white rounded-xl border border-blue-100 shadow-xs hover:shadow-sm hover:border-blue-300 transition-all flex items-center justify-between gap-3 group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <IconComponent size={14} />
                              </div>
                              <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 truncate">
                                {art.title}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-blue-600 shrink-0">
                              Ver →
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Categorías */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {HELP_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Lista de Artículos */}
                {selectedCategory !== 'faq' && filteredArticles.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      Guías y Tutoriales ({filteredArticles.length})
                    </h4>
                    <div className="space-y-2.5">
                      {filteredArticles.map((art) => {
                        const IconComponent = ICON_MAP[art.icon] || BookOpen;
                        return (
                          <div
                            key={art.id}
                            onClick={() => setSelectedArticle(art)}
                            className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-[#FEF3C7]/40 transition-all cursor-pointer group shadow-xs hover:shadow"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                                  <IconComponent size={16} />
                                </div>
                                <div>
                                  <h5 className="text-xs md:text-sm font-bold text-slate-800 group-hover:text-amber-950 transition-colors">
                                    {art.title}
                                  </h5>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                    <span className="font-semibold text-blue-600">
                                      {art.badge}
                                    </span>
                                    <span>•</span>
                                    <span>{art.time}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 group-hover:text-slate-700 mt-2 line-clamp-2">
                              {art.shortDesc}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lista de Preguntas Frecuentes (FAQ) */}
                {filteredFaqs.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      Preguntas Frecuentes ({filteredFaqs.length})
                    </h4>
                    <div className="space-y-2">
                      {filteredFaqs.map((faq) => {
                        const isExpanded = expandedFaq === faq.id;
                        return (
                          <div
                            key={faq.id}
                            className="rounded-xl border border-slate-200 overflow-hidden bg-white transition-all shadow-xs"
                          >
                            <button
                              onClick={() => toggleFaq(faq.id)}
                              className="w-full text-left p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {faq.category}
                                </span>
                                <span className="text-xs font-bold text-slate-800">
                                  {faq.q}
                                </span>
                              </div>
                              <span
                                className={`text-slate-400 transition-transform duration-200 shrink-0 ${
                                  isExpanded ? 'rotate-180 text-blue-600' : ''
                                }`}
                              >
                                <ChevronDown size={16} />
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="px-3.5 pb-3.5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50 animate-in fade-in duration-150">
                                {faq.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Estado vacío si no hay coincidencias */}
                {filteredArticles.length === 0 && filteredFaqs.length === 0 && (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <HelpCircle
                      size={32}
                      className="mx-auto text-slate-300 mb-2"
                    />
                    <p className="text-xs font-bold text-slate-700">
                      No encontramos resultados para "{searchQuery}"
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Intenta buscar con otras palabras como "backup", "partida", "iva" o "compartir".
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Documentación oficial CostBase
            </span>
            <span className="text-[11px] text-slate-400 font-mono">v1.0</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
