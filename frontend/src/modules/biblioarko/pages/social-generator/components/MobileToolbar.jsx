import React, { useState } from 'react';
import { FiType, FiBox, FiTrash2, FiLayers, FiDownload, FiSave, FiEye, FiSettings, FiChevronDown, FiSquare, FiCircle, FiCornerUpRight, FiBold, FiItalic, FiChevronUp, FiImage, FiFolder, FiCopy, FiVideo, FiMusic, FiVolumeX, FiVolume2, FiCheck, FiRefreshCw, FiPlusCircle } from 'react-icons/fi';
import { SHAPES_CONFIG, REACT_ICONS_CONFIG } from '../lib/svgIcons';
import { AUDIO_TRACKS } from '../constants';

export const MobileToolbar = ({ 
  canvas, 
  design,
  transform, 
  selectedElement, 
  onAddElement, 
  onDeleteElement, 
  onDownload,
  onSave,
  onSaveAs,
  onSaveTemplate,
  onPreview,
  currentSlide,
  activeProjectName,
  onConvertToVideo,
  isVideoMode = false,
  selectedAudio,
  setSelectedAudio,
  globalAudio,
  setGlobalAudio,
  audioApplyMode,
  setAudioApplyMode,
  userAudios,
  loadingAudios,
  handleUploadAudio,
  handleDeleteAudio,
  slideDuration,
  setSlideDuration
}) => {
  const [activePanel, setActivePanel] = useState(null);

  const togglePanel = (panel) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[120] pb-[env(safe-area-inset-bottom)]">
      {/* Expandable Panels */}
      {activePanel && (
        <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shadow-[0_-10px_40px_rgba(0,0,0,0.12)] animate-slideUp rounded-t-3xl overflow-hidden">
          
          {/* ─── TEXT PANEL ─── */}
          {activePanel === 'text' && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Agregar Texto</h3>
                <button onClick={() => setActivePanel(null)} className="p-1 text-gray-400"><FiChevronDown size={18} /></button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => { onAddElement(currentSlide, 'text', 'Título'); setActivePanel(null); }}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl active:scale-95 transition-all border border-gray-100 dark:border-gray-700"
                >
                  <span className="text-lg font-black text-indigo-600">T</span>
                  <span className="text-[9px] font-bold text-gray-500">Título</span>
                </button>
                <button
                  onClick={() => { onAddElement(currentSlide, 'text', 'Subtítulo'); setActivePanel(null); }}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl active:scale-95 transition-all border border-gray-100 dark:border-gray-700"
                >
                  <span className="text-base font-bold text-indigo-600">Aa</span>
                  <span className="text-[9px] font-bold text-gray-500">Subtítulo</span>
                </button>
                <button
                  onClick={() => { onAddElement(currentSlide, 'text', 'Cuerpo de texto'); setActivePanel(null); }}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl active:scale-95 transition-all border border-gray-100 dark:border-gray-700"
                >
                  <span className="text-sm text-indigo-600">Abc</span>
                  <span className="text-[9px] font-bold text-gray-500">Cuerpo</span>
                </button>
              </div>

              {/* Emojis quick row */}
              <div className="mt-4">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Emojis</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {['😀','😍','🔥','💡','✅','⭐','❤️','👍','🎯','💪','🚀','✨','📌','🏆','💎','🌟','👏','💬'].map((emoji, i) => (
                    <button
                      key={i}
                      onClick={() => { onAddElement(currentSlide, 'text', emoji); setActivePanel(null); }}
                      className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl text-lg active:scale-90 transition-all"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── SHAPES PANEL ─── */}
          {activePanel === 'shapes' && (
            <div className="p-5 max-h-[55vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Formas e Iconos</h3>
                <button onClick={() => setActivePanel(null)} className="p-1 text-gray-400"><FiChevronDown size={18} /></button>
              </div>
              
              {/* Basic shapes */}
              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-2">Formas Básicas</p>
              <div className="grid grid-cols-5 gap-2 mb-5">
                {SHAPES_CONFIG.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => { onAddElement(currentSlide, 'shape', shape.id); setActivePanel(null); }}
                    className="aspect-square flex flex-col items-center justify-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-2xl active:scale-90 transition-all border border-gray-100 dark:border-gray-700"
                  >
                    <div className="w-6 h-6 flex items-center justify-center text-indigo-600">
                      {React.cloneElement(shape.icon, { className: 'w-full h-full' })}
                    </div>
                    <span className="text-[7px] font-bold text-gray-400 leading-none">{shape.label}</span>
                  </button>
                ))}
              </div>

              {/* Icons */}
              {REACT_ICONS_CONFIG && REACT_ICONS_CONFIG.length > 0 && (
                <>
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-2">Iconos</p>
                  <div className="grid grid-cols-6 gap-2">
                    {REACT_ICONS_CONFIG.map((icon) => (
                      <button
                        key={icon.id}
                        onClick={() => { onAddElement(currentSlide, 'icon', icon.id); setActivePanel(null); }}
                        className="aspect-square flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl active:scale-90 transition-all text-gray-600 hover:text-indigo-600 border border-gray-100 dark:border-gray-700"
                        title={icon.label}
                      >
                        <div className="w-5 h-5 flex items-center justify-center">
                          {icon.icon}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── DESIGN PANEL ─── */}
          {activePanel === 'design' && design && (
            <div className="p-5 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Diseño</h3>
                <button onClick={() => setActivePanel(null)} className="p-1 text-gray-400"><FiChevronDown size={18} /></button>
              </div>
              
              <div className="space-y-6 pb-2">
                {/* Background */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Fondo</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <input type="color" value={design.bgColor} onChange={(e) => design.setBgColor(e.target.value)} className="w-10 h-10 rounded-xl border-none p-0 cursor-pointer" />
                      {design.useBgGradient && (
                        <>
                          <input type="color" value={design.bgColor2} onChange={(e) => design.setBgColor2(e.target.value)} className="w-10 h-10 rounded-xl border-none p-0 cursor-pointer" />
                          <input type="color" value={design.bgColor3} onChange={(e) => design.setBgColor3(e.target.value)} className="w-10 h-10 rounded-xl border-none p-0 cursor-pointer" />
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => design.setUseBgGradient(!design.useBgGradient)}
                      className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${design.useBgGradient ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
                    >
                      Gradiente
                    </button>
                  </div>
                </div>

                {/* Text Colors */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Colores de Texto</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <input type="color" value={design.titleColor} onChange={(e) => design.setTitleColor(e.target.value)} className="w-8 h-8 rounded-lg" />
                      <span className="text-[8px] font-black uppercase text-gray-400">Título</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <input type="color" value={design.contentColor} onChange={(e) => design.setContentColor(e.target.value)} className="w-8 h-8 rounded-lg" />
                      <span className="text-[8px] font-black uppercase text-gray-400">Cuerpo</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <input type="color" value={design.bulletColor} onChange={(e) => design.setBulletColor(e.target.value)} className="w-8 h-8 rounded-lg" />
                      <span className="text-[8px] font-black uppercase text-gray-400">Viñetas</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <input type="color" value={design.headerColor} onChange={(e) => design.setHeaderColor(e.target.value)} className="w-8 h-8 rounded-lg" />
                      <span className="text-[8px] font-black uppercase text-gray-400">Marca</span>
                    </div>
                  </div>
                </div>

                {/* Font Sizes */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Tamaños</p>
                  <div className="space-y-3 px-1">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase">
                        <span>Título</span><span>{design.titleFontSize}px</span>
                      </div>
                      <input type="range" min="16" max="48" value={design.titleFontSize} onChange={(e) => design.setTitleFontSize(Number(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase">
                        <span>Cuerpo</span><span>{design.fontSize}px</span>
                      </div>
                      <input type="range" min="10" max="24" value={design.fontSize} onChange={(e) => design.setFontSize(Number(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase">
                        <span>Marca</span><span>{design.headerFontSize}px</span>
                      </div>
                      <input type="range" min="8" max="24" value={design.headerFontSize} onChange={(e) => design.setHeaderFontSize(Number(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                  </div>
                </div>

                {/* Image Border Radius */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Bordes de Imágenes</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => design.setImageBorderRadius('0px')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[9px] font-black uppercase transition-all ${design.imageBorderRadius === '0px' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                      <FiSquare size={12} /> Cuadrado
                    </button>
                    <button onClick={() => design.setImageBorderRadius('24px')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[9px] font-black uppercase transition-all ${design.imageBorderRadius === '24px' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                      <FiCornerUpRight size={12} /> Redondo
                    </button>
                    <button onClick={() => design.setImageBorderRadius('999px')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[9px] font-black uppercase transition-all ${design.imageBorderRadius === '999px' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                      <FiCircle size={12} /> Círculo
                    </button>
                  </div>
                </div>

                {/* Selected Element Controls */}
                {selectedElement && (() => {
                  const [slideIdx, elId] = selectedElement.split('-');
                  const el = canvas.extraElements[slideIdx]?.find(e => e.id === elId);
                  if (!el) return null;
                  return (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl space-y-3">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Elemento Seleccionado</p>
                      <div className="flex items-center gap-2">
                        <input type="color" value={el.color} onChange={(e) => canvas.updateExtraElement(parseInt(slideIdx), elId, { color: e.target.value })} className="w-10 h-10 rounded-xl border-none p-0 cursor-pointer" />
                        {el.useGradient && (
                          <>
                            <input type="color" value={el.color2} onChange={(e) => canvas.updateExtraElement(parseInt(slideIdx), elId, { color2: e.target.value })} className="w-10 h-10 rounded-xl border-none p-0 cursor-pointer" />
                            <input type="color" value={el.color3} onChange={(e) => canvas.updateExtraElement(parseInt(slideIdx), elId, { color3: e.target.value })} className="w-10 h-10 rounded-xl border-none p-0 cursor-pointer" />
                          </>
                        )}
                        <button onClick={() => canvas.updateExtraElement(parseInt(slideIdx), elId, { useGradient: !el.useGradient })} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase ${el.useGradient ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                          Grad
                        </button>
                      </div>
                      {el.type === 'text' && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => canvas.updateExtraElement(parseInt(slideIdx), elId, { bold: !el.bold })} className={`p-2 rounded-xl ${el.bold ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}><FiBold size={14} /></button>
                          <button onClick={() => canvas.updateExtraElement(parseInt(slideIdx), elId, { italic: !el.italic })} className={`p-2 rounded-xl ${el.italic ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}><FiItalic size={14} /></button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          {/* ─── AUDIO PANEL ─── */}
          {activePanel === 'audio' && isVideoMode && (
            <div className="p-5 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Música y Tiempo</h3>
                <button onClick={() => setActivePanel(null)} className="p-1 text-gray-400"><FiChevronDown size={18} /></button>
              </div>

              {/* Duration Control */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Tiempo por Escena</span>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{slideDuration}s</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="0.5"
                  value={slideDuration}
                  onChange={(e) => setSlideDuration(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
              
              {/* Audio Tracks */}
              <div className="p-4 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-500 mb-3">Música / Audio</h3>
                
                {/* Toggle Global vs Diapositiva */}
                <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                  <button
                    onClick={() => setAudioApplyMode('global')}
                    className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                      audioApplyMode === 'global' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Todo el video
                  </button>
                  <button
                    onClick={() => setAudioApplyMode('slide')}
                    className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                      audioApplyMode === 'slide' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Solo en esta
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {/* None */}
                  <button
                    onClick={() => audioApplyMode === 'global' ? setGlobalAudio(null) : setSelectedAudio(null)}
                    className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-all flex justify-between items-center ${
                      !(audioApplyMode === 'global' ? globalAudio : selectedAudio) ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2"><FiVolumeX /> Sin Música</span>
                    {!(audioApplyMode === 'global' ? globalAudio : selectedAudio) && <FiCheck className="text-indigo-600" />}
                  </button>

                  {/* Default */}
                  {Object.entries(AUDIO_TRACKS).map(([name, path]) => (
                    <button
                      key={name}
                      onClick={() => audioApplyMode === 'global' ? setGlobalAudio(name) : setSelectedAudio(name)}
                      className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-all flex justify-between items-center ${
                        (audioApplyMode === 'global' ? globalAudio : selectedAudio) === name ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate"><FiVolume2 className={(audioApplyMode === 'global' ? globalAudio : selectedAudio) === name ? 'text-indigo-500' : 'text-gray-400'} /> {name}</span>
                      {(audioApplyMode === 'global' ? globalAudio : selectedAudio) === name && <FiCheck className="text-indigo-600" />}
                    </button>
                  ))}
                </div>

                {/* User Audios */}
                {userAudios?.length > 0 && (
                  <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
                    {userAudios?.map(audio => (
                      <div key={audio.id} className="flex gap-1 mb-2">
                        <button
                          onClick={() => audioApplyMode === 'global' ? setGlobalAudio(`User-${audio.id}`) : setSelectedAudio(`User-${audio.id}`)}
                          className={`flex-1 text-left px-3 py-3 rounded-xl text-sm transition-all flex justify-between items-center ${
                            (audioApplyMode === 'global' ? globalAudio : selectedAudio) === `User-${audio.id}` ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate max-w-[200px]"><FiVolume2 className={(audioApplyMode === 'global' ? globalAudio : selectedAudio) === `User-${audio.id}` ? 'text-indigo-500' : 'text-gray-400'} /> {audio.original_name}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAudio(audio.id)}
                          className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition-all"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Audio */}
                <div className="pt-4 mt-2">
                  <label className={`w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${loadingAudios ? 'bg-gray-50 border-gray-200 text-gray-400' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400'}`}>
                    {loadingAudios ? <FiRefreshCw className="animate-spin" /> : <FiPlusCircle />}
                    <span className="text-sm font-bold">{loadingAudios ? 'Subiendo...' : 'Subir Audio (MP3)'}</span>
                    <input type="file" className="hidden" accept="audio/mpeg,audio/mp3,audio/wav" onChange={handleUploadAudio} disabled={loadingAudios} />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── PROJECT NAME BAR ─── */}
      {activeProjectName && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-1.5 flex items-center justify-between border-t border-indigo-100 dark:border-indigo-800">
          <div className="flex items-center gap-1.5 min-w-0">
            <FiFolder className="text-indigo-500 flex-shrink-0" size={12} />
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wide truncate">{activeProjectName}</span>
          </div>
        </div>
      )}

      {/* ─── BOTTOM BAR ─── */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between px-3 py-2">
          {/* Left: Creation tools */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => togglePanel('text')}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${activePanel === 'text' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-50 dark:bg-gray-800 text-gray-500'}`}
            >
              <FiType size={18} />
              <span className="text-[7px] font-bold mt-0.5">Texto</span>
            </button>
            <button
              onClick={() => togglePanel('shapes')}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${activePanel === 'shapes' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-50 dark:bg-gray-800 text-gray-500'}`}
            >
              <FiBox size={18} />
              <span className="text-[7px] font-bold mt-0.5">Formas</span>
            </button>
            <button
              onClick={() => togglePanel('design')}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${activePanel === 'design' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-50 dark:bg-gray-800 text-gray-500'}`}
            >
              <FiSettings size={18} />
              <span className="text-[7px] font-bold mt-0.5">Diseño</span>
            </button>
            {isVideoMode && (
              <button
                onClick={() => togglePanel('audio')}
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${activePanel === 'audio' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-50 dark:bg-gray-800 text-gray-500'}`}
              >
                <FiMusic size={18} />
                <span className="text-[7px] font-bold mt-0.5">Audio</span>
              </button>
            )}
          </div>

          {/* Center: Selected element actions */}
          {selectedElement && (
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 p-1 rounded-xl border border-amber-100 dark:border-amber-800">
              <button onClick={() => {
                if (selectedElement) {
                  const [slideIdx, elId] = selectedElement.split('-');
                  const el = canvas.extraElements[slideIdx]?.find(e => e.id === elId);
                  if (el) canvas.updateExtraElement(parseInt(slideIdx), elId, { zIndex: el.zIndex === 30 ? 5 : 30 });
                }
              }} className="p-2 rounded-lg text-amber-600"><FiLayers size={16} /></button>
              <button onClick={onDeleteElement} className="p-2 rounded-lg text-red-500"><FiTrash2 size={16} /></button>
            </div>
          )}

          {/* Right: Action buttons */}
          <div className="flex items-center gap-1">
            {!isVideoMode && (
              <button onClick={onConvertToVideo} className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-amber-500 text-white shadow-lg transition-all active:scale-95">
                <FiVideo size={16} />
                <span className="text-[6px] font-bold mt-0.5">Video</span>
              </button>
            )}
            <button onClick={onPreview} className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-500 transition-all">
              <FiEye size={16} />
              <span className="text-[6px] font-bold mt-0.5">Ver</span>
            </button>
            <button onClick={onSave} className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-emerald-500 text-white shadow-lg transition-all">
              <FiSave size={16} />
              <span className="text-[6px] font-bold mt-0.5">Guardar</span>
            </button>
            {onSaveTemplate && (
              <button onClick={onSaveTemplate} className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 border border-amber-100 dark:border-amber-800 transition-all">
                <FiCopy size={16} />
                <span className="text-[6px] font-bold mt-0.5">Plantilla</span>
              </button>
            )}
            <button onClick={onDownload} className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white shadow-lg transition-all">
              {isVideoMode ? <FiVideo size={16} /> : <FiDownload size={16} />}
              <span className="text-[6px] font-bold mt-0.5">{isVideoMode ? 'Gen. MP4' : 'Bajar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


