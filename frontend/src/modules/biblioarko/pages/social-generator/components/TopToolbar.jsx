import React, { useState } from 'react';
import { FiUpload, FiTrash2, FiLayers, FiSave, FiChevronDown, FiFolder, FiDownload, FiPlusSquare, FiSquare, FiCircle, FiCornerUpRight, FiType, FiBold, FiItalic, FiCornerUpLeft } from 'react-icons/fi';
import { SHAPES_CONFIG } from '../lib/svgIcons';
const Modal = ({ isOpen, onClose, title, children }) => isOpen ? (<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"><div className="bg-white p-6 rounded-lg"><h2>{title}</h2>{children}<button onClick={onClose}>Cerrar</button></div></div>) : null;

export const TopToolbar = ({ 
  design, 
  canvas, 
  onDownload, 
  onWatermark, 
  watermark, 
  onApplyTemplate, 
  totalSlides,
  onLoadProject,
  generatedContent,
  onUndo,
  canUndo
}) => {
  const {
    bgColor, setBgColor, bgColor2, setBgColor2, bgColor3, setBgColor3,
    useBgGradient, setUseBgGradient, fontSize, setFontSize,
    titleFontSize, setTitleFontSize,
    headerFontSize, setHeaderFontSize, titleColor, setTitleColor,
    contentColor, setContentColor, headerColor, setHeaderColor,
    imageBorderRadius, setImageBorderRadius,
    dividerColor, setDividerColor,
    dividerHeight, setDividerHeight, dividerWidth, setDividerWidth
  } = design;

  const { 
    selectedExtraId, extraElements, updateExtraElement, removeExtraElement, 
    selectedLogo, selectedDoctorName, selectedDivider, 
    customTemplates, saveCustomTemplate, applyCustomTemplate, deleteTemplate,
    projects, saveProject, deleteProject,
    addExtraElement, currentSlidePage
  } = canvas;

  const [showTemplates, setShowTemplates] = useState(false);
  const [showElements, setShowElements] = useState(false);
  const [saveModal, setSaveModal] = useState({ open: false, type: 'project', title: '' });
  const [saveName, setSaveName] = useState('');

  const handleSaveTemplate = () => {
    setSaveName('');
    setSaveModal({ open: true, type: 'template', title: 'Guardar como Plantilla' });
  };

  const handleSaveProject = () => {
    setSaveName('');
    setSaveModal({ open: true, type: 'project', title: 'Guardar Proyecto' });
  };

  const confirmSave = () => {
    if (!saveName.trim()) return;
    
    if (saveModal.type === 'template') {
      saveCustomTemplate(saveName);
    } else {
      saveProject(saveName, generatedContent);
    }
    setSaveModal({ ...saveModal, open: false });
  };

  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6">
      
      {/* Absolute Download Button */}
      <div className="absolute top-6 right-6 z-10 flex gap-2">
        <button onClick={onDownload} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-3 transform hover:scale-105 active:scale-95 whitespace-nowrap">
          Descargar ZIP <FiDownload size={18} />
        </button>
      </div>

      {/* Row 1: Templates & Insert Controls */}
      <div className="flex flex-wrap items-center gap-6 pr-64">
        
        {/* Templates Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-3 px-5 py-3 bg-indigo-50 dark:bg-indigo-900/50 hover:bg-indigo-100 rounded-2xl border border-indigo-100 dark:border-indigo-700 transition-all group"
          >
            <div className="text-left">
              <p className="text-[9px] font-black uppercase text-indigo-400 leading-none mb-1">Diseño</p>
              <p className="text-sm font-black text-indigo-600">Mis Plantillas</p>
            </div>
            <FiChevronDown className={`transition-transform duration-300 ${showTemplates ? 'rotate-180' : ''}`} />
          </button>

          {showTemplates && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-[32px] shadow-2xl border border-gray-100 dark:border-gray-700 z-[100] overflow-hidden animate-fadeIn">
              <div className="p-4 border-b border-gray-50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-gray-400">Seleccionar Estilo</span>
                <button onClick={handleSaveTemplate} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                  <FiSave size={12} /> Guardar
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {customTemplates.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 italic text-sm">No hay plantillas guardadas</div>
                ) : (
                  customTemplates.map(t => (
                    <div key={t.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 border-b border-gray-50 dark:border-gray-700/50 flex items-center justify-between group">
                      <button 
                        onClick={() => { applyCustomTemplate(t, totalSlides); setShowTemplates(false); }}
                        className="text-left flex-1"
                      >
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{t.name}</p>
                      </button>
                      <button onClick={() => deleteTemplate(t.id)} className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 transition-all">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Elements Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowElements(!showElements)}
            className="flex items-center gap-3 px-5 py-3 bg-amber-50 dark:bg-amber-900/50 hover:bg-amber-100 rounded-2xl border border-amber-100 dark:border-amber-700 transition-all group"
          >
            <div className="text-left">
              <p className="text-[9px] font-black uppercase text-amber-500 leading-none mb-1">Insertar</p>
              <p className="text-sm font-black text-amber-600">Elementos Gráficos</p>
            </div>
            <FiPlusSquare className="text-amber-500" />
          </button>

          {showElements && (
            <div className="absolute top-full left-0 mt-2 w-[400px] bg-white dark:bg-gray-800 rounded-[32px] shadow-2xl border border-gray-100 dark:border-gray-700 z-[110] overflow-hidden animate-fadeIn p-4">
              <div className="grid grid-cols-3 gap-3">
                {SHAPES_CONFIG.map(shape => (
                  <button 
                    key={shape.id}
                    onClick={() => { addExtraElement(currentSlidePage, 'icon', shape.id); setShowElements(false); }}
                    className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 rounded-2xl transition-all border border-gray-50"
                  >
                    <div className="text-gray-600">{shape.icon}</div>
                    <span className="text-[9px] font-black uppercase text-gray-400 text-center">{shape.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text Quick Action */}
        <button 
          onClick={() => addExtraElement(currentSlidePage, 'text')}
          className="flex items-center gap-3 px-5 py-3 bg-purple-50 dark:bg-purple-900/50 hover:bg-purple-100 rounded-2xl border border-purple-100 dark:border-purple-700 transition-all group"
        >
          <div className="text-left">
            <p className="text-[9px] font-black uppercase text-purple-400 leading-none mb-1">Insertar</p>
            <p className="text-sm font-black text-purple-600">Caja de Texto</p>
          </div>
          <FiType className="text-purple-500" />
        </button>

        {/* Save Project Action */}
        <button onClick={handleSaveProject} className="flex items-center gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 rounded-2xl border border-gray-100 dark:border-gray-700 transition-all group">
          <div className="text-left">
            <p className="text-[9px] font-black uppercase text-gray-400 leading-none mb-1">Acción</p>
            <p className="text-sm font-black text-gray-600">Guardar Proyecto</p>
          </div>
          <FiSave className="text-gray-400" />
        </button>

        {/* Undo Action */}
        <button 
          onClick={onUndo} 
          disabled={!canUndo}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all group ${canUndo ? 'bg-amber-50 border-amber-100 hover:bg-amber-100' : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'}`}
        >
          <div className="text-left">
            <p className={`text-[9px] font-black uppercase leading-none mb-1 ${canUndo ? 'text-amber-400' : 'text-gray-400'}`}>Historial</p>
            <p className={`text-sm font-black ${canUndo ? 'text-amber-600' : 'text-gray-600'}`}>Deshacer</p>
          </div>
          <FiCornerUpLeft className={canUndo ? 'text-amber-500' : 'text-gray-400'} />
        </button>

        {/* BG Colors */}
        <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 px-4 py-2 rounded-2xl border border-gray-100">
          <p className="text-[9px] font-black uppercase text-gray-400">Fondo</p>
          <div className="flex items-center gap-2">
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-8 w-12 p-0.5 bg-white border border-gray-200 cursor-pointer rounded-lg" />
            {useBgGradient && (
              <>
                <input type="color" value={bgColor2} onChange={(e) => setBgColor2(e.target.value)} className="h-8 w-12 p-0.5 bg-white border border-gray-200 cursor-pointer rounded-lg" />
                <input type="color" value={bgColor3} onChange={(e) => setBgColor3(e.target.value)} className="h-8 w-12 p-0.5 bg-white border border-gray-200 cursor-pointer rounded-lg" />
              </>
            )}
            <button onClick={() => setUseBgGradient(!useBgGradient)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${useBgGradient ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>Gradient</button>
          </div>
        </div>
      </div>

      {/* Row 2: Typography & Borders */}
      <div className="flex flex-wrap items-center gap-8 pt-6 border-t border-gray-50">
        
        {/* Colors Group */}
        <div className="flex items-center gap-4 pr-6 border-r border-gray-100">
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-black uppercase text-gray-400">Título</p>
            <input type="color" value={titleColor} onChange={(e) => setTitleColor(e.target.value)} className="h-8 w-12 p-1 bg-white border border-gray-200 rounded-lg" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-black uppercase text-gray-400">Texto</p>
            <input type="color" value={contentColor} onChange={(e) => setContentColor(e.target.value)} className="h-8 w-12 p-1 bg-white border border-gray-200 rounded-lg" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-black uppercase text-gray-400">Viñetas</p>
            <input type="color" value={design.bulletColor} onChange={(e) => design.setBulletColor(e.target.value)} className="h-8 w-12 p-1 bg-white border border-gray-200 rounded-lg" />
          </div>
        </div>

        {/* Font Sliders */}
        <div className="flex items-center gap-6 pr-6 border-r border-gray-100">
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-black uppercase text-gray-400">T. Título</p>
            <div className="flex items-center gap-2">
              <input type="range" min={16} max={48} step={1} value={titleFontSize} onChange={(e) => setTitleFontSize(Number(e.target.value))} className="w-20" />
              <span className="text-[9px] font-mono text-gray-400">{titleFontSize}px</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-black uppercase text-gray-400">T. Texto</p>
            <div className="flex items-center gap-2">
              <input type="range" min={10} max={24} step={1} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-20" />
              <span className="text-[9px] font-mono text-gray-400">{fontSize}px</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-black uppercase text-gray-400">T. Marca</p>
            <div className="flex items-center gap-2">
              <input type="range" min={8} max={24} step={1} value={headerFontSize} onChange={(e) => setHeaderFontSize(Number(e.target.value))} className="w-20" />
              <span className="text-[9px] font-mono text-gray-400">{headerFontSize}px</span>
            </div>
          </div>
        </div>

        {/* Image Border Radius Selector */}
        <div className="flex flex-col gap-2 pr-6 border-r border-gray-100">
          <p className="text-[9px] font-black uppercase text-gray-400">Bordes Imágenes</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setImageBorderRadius('0px')} className={`p-2 rounded-lg transition-all ${imageBorderRadius === '0px' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`} title="Cuadrado"><FiSquare size={14} /></button>
            <button onClick={() => setImageBorderRadius('24px')} className={`p-2 rounded-lg transition-all ${imageBorderRadius === '24px' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`} title="Redondeado"><FiCornerUpRight size={14} /></button>
            <button onClick={() => setImageBorderRadius('999px')} className={`p-2 rounded-lg transition-all ${imageBorderRadius === '999px' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`} title="Círculo"><FiCircle size={14} /></button>
          </div>
        </div>

        {/* Apply All Action */}
        <button onClick={onApplyTemplate} className="ml-auto px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center gap-2">
          Replicar Diseño a Todo <FiPlusSquare />
        </button>
      </div>

      {/* Contextual Element Toolbar */}
      {(selectedExtraId || selectedLogo || selectedDoctorName || selectedDivider) && (
        <div className="w-full flex items-center gap-6 bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-2xl animate-slideUp border border-indigo-100/50">
          {selectedExtraId && (() => {
            const [slideIdx, elId] = selectedExtraId.split('-');
            const sIdx = parseInt(slideIdx);
            const el = extraElements[sIdx]?.find(e => e.id === elId);
            if (!el) return null;

            return (
              <>
                <div className="flex items-center gap-3 pr-6 border-r border-indigo-100">
                  <span className="text-[10px] font-black uppercase text-indigo-400">Color Elemento</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={el.color} onChange={(e) => updateExtraElement(sIdx, el.id, { color: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer" />
                    {el.useGradient && (
                      <>
                        <input type="color" value={el.color2} onChange={(e) => updateExtraElement(sIdx, el.id, { color2: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer" />
                        <input type="color" value={el.color3} onChange={(e) => updateExtraElement(sIdx, el.id, { color3: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer" />
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 px-6 border-r border-indigo-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={el.useGradient} onChange={(e) => updateExtraElement(sIdx, el.id, { useGradient: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                    <span className="text-[10px] font-black uppercase text-gray-500">Gradiente</span>
                  </label>
                </div>
                <div className="flex items-center gap-2 px-6 border-r border-indigo-100">
                  <button 
                    onClick={() => updateExtraElement(sIdx, el.id, { bold: !el.bold })} 
                    className={`p-2 rounded-lg transition-all ${el.bold ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                    title="Negrita"
                  >
                    <FiBold size={14} />
                  </button>
                  <button 
                    onClick={() => updateExtraElement(sIdx, el.id, { italic: !el.italic })} 
                    className={`p-2 rounded-lg transition-all ${el.italic ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                    title="Cursiva"
                  >
                    <FiItalic size={14} />
                  </button>
                </div>
                {el.type === 'text' && (
                  <div className="flex-1 flex items-center gap-4 px-6 border-r border-indigo-100">
                    <span className="text-[10px] font-black uppercase text-indigo-400 shrink-0">Editar Texto</span>
                    <input 
                      type="text" 
                      value={el.content} 
                      onChange={(e) => updateExtraElement(sIdx, el.id, { content: e.target.value })}
                      className="flex-1 bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold outline-none"
                    />
                  </div>
                )}
                <div className="flex items-center gap-4 ml-auto">
                  <button onClick={() => updateExtraElement(sIdx, el.id, { zIndex: el.zIndex === 5 ? 30 : 5 })} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${el.zIndex === 5 ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400'}`}>
                    <FiLayers size={14} /> <span className="text-[8px] font-black uppercase">Capa {el.zIndex === 5 ? 'Inf' : 'Sup'}</span>
                  </button>
                  <button onClick={() => removeExtraElement(sIdx, el.id)} className="w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </>
            );
          })()}

          {selectedLogo && (
            <div className="flex-1 flex items-center gap-8">
              <div className="text-[10px] font-black uppercase text-indigo-400">Configuración de Logo</div>
              <p className="text-xs text-indigo-500/70 font-bold">Puedes arrastrar el logo a cualquier lugar de la diapositiva.</p>
              <div className="ml-auto text-[10px] font-black uppercase text-indigo-500 bg-white px-4 py-2 rounded-xl border border-indigo-100">
                Logo Seleccionado
              </div>
            </div>
          )}

          {selectedDoctorName && (
            <div className="flex-1 flex items-center gap-8">
              <div className="text-[10px] font-black uppercase text-indigo-400">Configuración de Nombre</div>
              <p className="text-xs text-indigo-500/70 font-bold">Puedes arrastrar el nombre a cualquier lugar de la diapositiva.</p>
              <div className="ml-auto text-[10px] font-black uppercase text-indigo-500 bg-white px-4 py-2 rounded-xl border border-indigo-100">
                Autor / Especialista
              </div>
            </div>
          )}

          {selectedDivider && (
            <div className="flex-1 flex items-center gap-8">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase text-indigo-400">Color Línea</span>
                <input type="color" value={dividerColor} onChange={(e) => setDividerColor(e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black uppercase text-indigo-400">Grosor</p>
                <input type="range" min={1} max={10} step={1} value={dividerHeight} onChange={(e) => setDividerHeight(Number(e.target.value))} className="w-32" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black uppercase text-indigo-400">Ancho %</p>
                <input type="range" min={10} max={100} step={5} value={dividerWidth} onChange={(e) => setDividerWidth(Number(e.target.value))} className="w-32" />
              </div>
              <div className="ml-auto text-[10px] font-black uppercase text-indigo-500 bg-white px-4 py-2 rounded-xl border border-indigo-100">
                Línea de Cabecera Seleccionada
              </div>
            </div>
          )}
        </div>
      )}
      {/* Modal para Guardar */}
      <Modal 
        isOpen={saveModal.open} 
        onClose={() => setSaveModal({ ...saveModal, open: false })}
        title={saveModal.title}
        size="sm"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Nombre del {saveModal.type === 'template' ? 'diseño' : 'proyecto'}</label>
            <input 
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Ej: Lanzamiento Marzo 2024"
              autoFocus
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all text-gray-700 font-bold"
              onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
            />
            <p className="text-[10px] text-gray-400 font-medium">
              {saveModal.type === 'template' 
                ? 'Se guardará solo el estilo visual (colores, fuentes, logos).' 
                : 'Se guardará el contenido de las diapositivas y el diseño completo.'}
            </p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setSaveModal({ ...saveModal, open: false })}
              className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl text-xs font-black hover:bg-gray-200 transition-all"
            >
              CANCELAR
            </button>
            <button 
              onClick={confirmSave}
              disabled={!saveName.trim()}
              className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              CONFIRMAR Y GUARDAR
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};


