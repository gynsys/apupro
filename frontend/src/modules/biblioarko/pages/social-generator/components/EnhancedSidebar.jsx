import React, { useState } from 'react';
import { FiType, FiBox, FiPlusCircle, FiSettings, FiLayers, FiMove, FiRotateCw, FiMaximize2, FiDownload, FiSave, FiCopy, FiEye, FiEdit3, FiChevronLeft, FiChevronRight, FiChevronDown, FiSquare, FiCircle, FiCornerUpRight, FiBold, FiItalic, FiFolder, FiCheck, FiX, FiAlertTriangle, FiBell, FiCalendar, FiClock, FiMail, FiPhone, FiUser, FiMapPin, FiHome, FiBriefcase, FiHeart, FiStar, FiTrendingUp, FiActivity, FiZap, FiSun, FiMoon, FiCloud, FiUmbrella, FiTarget, FiCompass, FiNavigation, FiFlag, FiBookmark, FiMessageSquare, FiShare2, FiRefreshCw, FiCpu, FiDatabase, FiWifi, FiBluetooth, FiBattery, FiVolume2, FiVolumeX, FiPlay, FiPause, FiSkipBack, FiSkipForward, FiRepeat, FiVideo, FiTrash2, FiSmile } from 'react-icons/fi';
import { SHAPES_CONFIG, REACT_ICONS_CONFIG } from '../lib/svgIcons';
import { AUDIO_TRACKS } from '../constants';

export const EnhancedSidebar = ({ 
  design, 
  canvas, 
  transform, 
  currentSlide, 
  onAddElement, 
  onDownload, 
  onSave, 
  onPreview,
  selectedElement,
  totalSlides,
  generatedContent,
  onRemoveImage,
  onConvertToVideo,
  isVideoMode,
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
  setSlideDuration,
  isExporting,
  exportProgress
}) => {
  const [activeTab, setActiveTab] = useState('elements');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTextElements, setShowTextElements] = useState(false);
  const [showShapeElements, setShowShapeElements] = useState(false);
  const [showIconElements, setShowIconElements] = useState(false);
  const [showEmojiElements, setShowEmojiElements] = useState(false);
  const [selectedFont, setSelectedFont] = useState('Arial');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateToDelete, setTemplateToDelete] = useState(null);

  return (
    <div className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-80'} flex flex-col h-full`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Herramientas</h2>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiChevronLeft className={`transition-transform ${isCollapsed ? 'rotate-180' : ''}`} size={16} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      {!isCollapsed && (
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('elements')}
            className={`flex-1 px-4 py-3 text-xs font-black transition-all ${
              activeTab === 'elements' 
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 border-b-2 border-indigo-600' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Elementos
          </button>
          <button
            onClick={() => setActiveTab('design')}
            className={`flex-1 px-4 py-3 text-xs font-black transition-all ${
              activeTab === 'design' 
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 border-b-2 border-indigo-600' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Diseño
          </button>
          {isVideoMode && (
            <button
              onClick={() => setActiveTab('audio')}
              className={`flex-1 px-4 py-3 text-xs font-black transition-all ${
                activeTab === 'audio' 
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 border-b-2 border-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Audio
            </button>
          )}
          <button
            onClick={() => setActiveTab('actions')}
            className={`flex-1 px-4 py-3 text-xs font-black transition-all ${
              activeTab === 'actions' 
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 border-b-2 border-indigo-600' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Acciones
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isCollapsed ? (
          /* Collapsed State - Icon Only */
          <div className="p-2 space-y-2">
            <button
              onClick={() => onAddElement(currentSlide, 'text', 'Texto')}
              className="w-full p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400"
              title="Agregar texto"
            >
              <FiType size={20} />
            </button>
            <button
              onClick={() => onAddElement(currentSlide, 'shape', 'circle')}
              className="w-full p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400"
              title="Agregar círculo"
            >
              <div className="w-5 h-5 bg-indigo-600 rounded-full"></div>
            </button>
            <button
              onClick={() => onAddElement(currentSlide, 'shape', 'square')}
              className="w-full p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400"
              title="Agregar cuadro"
            >
              <div className="w-5 h-5 bg-indigo-600"></div>
            </button>
            <button
              onClick={() => onAddElement(currentSlide, 'shape', 'arrow')}
              className="w-full p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400"
              title="Agregar flecha"
            >
              <FiMove size={20} />
            </button>
          </div>
        ) : (
          <>
            {/* Elements Tab */}
            {activeTab === 'elements' && (
              <div className="p-4 space-y-4">
                {/* Text Elements */}
                <div>
                  <button
                    onClick={() => setShowTextElements(!showTextElements)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <span className="text-sm font-bold flex items-center gap-2"><FiType className="text-indigo-500" /> Textos</span>
                    <FiChevronDown className={`transition-transform ${showTextElements ? 'rotate-180' : ''}`} />
                  </button>
                  {showTextElements && (
                    <div className="mt-2 space-y-2 pl-4">
                      <button
                        onClick={() => onAddElement(currentSlide, 'text', 'Título')}
                        className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-left font-bold hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm"
                      >
                        Título
                      </button>
                      <button
                        onClick={() => onAddElement(currentSlide, 'text', 'Subtítulo')}
                        className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm"
                      >
                        Subtítulo
                      </button>
                      <button
                        onClick={() => onAddElement(currentSlide, 'text', 'Cuerpo')}
                        className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cuerpo de texto
                      </button>
                    </div>
                  )}
                </div>

                {/* Shape Elements */}
                <div>
                  <button
                    onClick={() => setShowShapeElements(!showShapeElements)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <span className="text-sm font-bold flex items-center gap-2"><FiBox className="text-indigo-500" /> Formas</span>
                    <FiChevronDown className={`transition-transform ${showShapeElements ? 'rotate-180' : ''}`} />
                  </button>
                  {showShapeElements && (
                    <div className="mt-2 grid grid-cols-3 gap-2 pl-4">
                      {SHAPES_CONFIG.map(shape => (
                        <button 
                          key={shape.id}
                          onClick={() => onAddElement(currentSlide, 'shape', shape.id)} 
                          className="aspect-square bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-all group p-2" 
                          title={shape.label}
                        >
                          <div className="group-hover:scale-110 transition-transform">
                            {shape.icon}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Icon Elements */}
                <div>
                  <button
                    onClick={() => setShowIconElements(!showIconElements)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <span className="text-sm font-bold flex items-center gap-2"><FiStar className="text-indigo-500" /> Iconos</span>
                    <FiChevronDown className={`transition-transform ${showIconElements ? 'rotate-180' : ''}`} />
                  </button>
                  {showIconElements && (
                    <div className="mt-2 grid grid-cols-4 gap-2 pl-4">
                      {REACT_ICONS_CONFIG.map(icon => (
                        <button 
                          key={icon.id}
                          onClick={() => onAddElement(currentSlide, 'icon', icon.id)} 
                          className="aspect-square bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center text-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-all group p-2" 
                          title={icon.label}
                        >
                          <div className="group-hover:scale-110 transition-transform">
                            {icon.icon}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Emoji Elements */}
                <div>
                  <button
                    onClick={() => setShowEmojiElements(!showEmojiElements)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <span className="text-sm font-bold flex items-center gap-2"><FiSmile className="text-indigo-500" /> Emojis</span>
                    <FiChevronDown className={`transition-transform ${showEmojiElements ? 'rotate-180' : ''}`} />
                  </button>
                  {showEmojiElements && (
                    <div className="mt-2 grid grid-cols-6 gap-1 pl-4">
                      {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'].map((emoji, index) => (
                        <button 
                          key={index}
                          onClick={() => onAddElement(currentSlide, 'text', emoji)} 
                          className="aspect-square bg-white dark:bg-gray-900 rounded-lg flex items-center justify-center text-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all p-1" 
                          title={`Emoji ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Design Tab */}
            {activeTab === 'design' && (
              <div className="p-4 space-y-6">
                {/* Duration Control (Only in Video Mode) */}
                {isVideoMode && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Tiempo por Escena</h3>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{slideDuration}s</span>
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
                    <div className="flex justify-between text-[9px] font-bold text-gray-400 mt-1 uppercase">
                      <span>Rápido (2s)</span>
                      <span>Lento (10s)</span>
                    </div>
                  </div>
                )}

                {/* Background Colors & Gradients */}
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Fondo</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.bgColor}
                        onChange={(e) => design.setBgColor(e.target.value)}
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                      {design.useBgGradient && (
                        <>
                          <input
                            type="color"
                            value={design.bgColor2}
                            onChange={(e) => design.setBgColor2(e.target.value)}
                            className="w-12 h-8 rounded cursor-pointer"
                          />
                          <input
                            type="color"
                            value={design.bgColor3}
                            onChange={(e) => design.setBgColor3(e.target.value)}
                            className="w-12 h-8 rounded cursor-pointer"
                          />
                        </>
                      )}
                      <button
                        onClick={() => design.setUseBgGradient(!design.useBgGradient)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                          design.useBgGradient ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Gradiente
                      </button>
                    </div>
                  </div>
                </div>

                {/* Text Colors */}
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Colores de Texto</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600 dark:text-gray-400">Título</label>
                      <input
                        type="color"
                        value={design.titleColor}
                        onChange={(e) => design.setTitleColor(e.target.value)}
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600 dark:text-gray-400">Contenido</label>
                      <input
                        type="color"
                        value={design.contentColor}
                        onChange={(e) => design.setContentColor(e.target.value)}
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600 dark:text-gray-400">{isVideoMode ? 'Resaltado' : 'Marca'}</label>
                      <input
                        type="color"
                        value={design.headerColor}
                        onChange={(e) => design.setHeaderColor(e.target.value)}
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600 dark:text-gray-400">Viñetas</label>
                      <input
                        type="color"
                        value={design.bulletColor}
                        onChange={(e) => design.setBulletColor(e.target.value)}
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Typography */}
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Tipografía</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Fuente</label>
                      <select
                        value={design.fontFamily || 'Manrope'}
                        onChange={(e) => design.setFontFamily(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                      >
                        <option value="Manrope">Manrope</option>
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Playfair Display">Playfair Display</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Título</label>
                        <span className="text-[9px] font-mono text-gray-500">{design.titleFontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="16"
                        max="48"
                        value={design.titleFontSize}
                        onChange={(e) => design.setTitleFontSize(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Contenido</label>
                        <span className="text-[9px] font-mono text-gray-500">{design.fontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="24"
                        value={design.fontSize}
                        onChange={(e) => design.setFontSize(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-gray-600 dark:text-gray-400">{isVideoMode ? 'Resaltado' : 'Marca'}</label>
                        <span className="text-[9px] font-mono text-gray-500">{design.headerFontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="8"
                        max="24"
                        value={design.headerFontSize}
                        onChange={(e) => design.setHeaderFontSize(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Image Border Radius */}
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Bordes de Imágenes</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => design.setImageBorderRadius('0px')}
                      className={`p-2 rounded-lg transition-all ${
                        design.imageBorderRadius === '0px'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title="Cuadrado"
                    >
                      <FiSquare size={14} />
                    </button>
                    <button
                      onClick={() => design.setImageBorderRadius('24px')}
                      className={`p-2 rounded-lg transition-all ${
                        design.imageBorderRadius === '24px'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title="Redondeado"
                    >
                      <FiCornerUpRight size={14} />
                    </button>
                    <button
                      onClick={() => design.setImageBorderRadius('999px')}
                      className={`p-2 rounded-lg transition-all ${
                        design.imageBorderRadius === '999px'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title="Círculo"
                    >
                      <FiCircle size={14} />
                    </button>
                  </div>
                </div>

                {/* Selected Element Controls */}
                {selectedElement && (() => {
                  const [slideIdx, elId] = selectedElement.split('-');
                  const el = canvas.extraElements[slideIdx]?.find(e => e.id === elId);
                  if (!el) return null;

                  return (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                      <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3">Elemento Seleccionado</h3>
                      <div className="space-y-3">
                        {/* Element Color Controls */}
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">Color del Elemento</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={el.color}
                              onChange={(e) => canvas.updateExtraElement(parseInt(slideIdx), elId, { color: e.target.value })}
                              className="w-12 h-8 rounded cursor-pointer"
                            />
                            {el.useGradient && (
                              <>
                                <input
                                  type="color"
                                  value={el.color2}
                                  onChange={(e) => canvas.updateExtraElement(parseInt(slideIdx), elId, { color2: e.target.value })}
                                  className="w-12 h-8 rounded cursor-pointer"
                                />
                                <input
                                  type="color"
                                  value={el.color3}
                                  onChange={(e) => canvas.updateExtraElement(parseInt(slideIdx), elId, { color3: e.target.value })}
                                  className="w-12 h-8 rounded cursor-pointer"
                                />
                              </>
                            )}
                          </div>
                        </div>

                        {/* Gradient Toggle */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={el.useGradient}
                            onChange={(e) => canvas.updateExtraElement(parseInt(slideIdx), elId, { useGradient: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                          />
                          <label className="text-xs text-gray-600 dark:text-gray-400">Usar Gradiente</label>
                        </div>

                        {/* Text Formatting (for text elements) */}
                        {el.type === 'text' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => canvas.updateExtraElement(parseInt(slideIdx), elId, { bold: !el.bold })}
                              className={`p-2 rounded-lg transition-all ${
                                el.bold ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                              title="Negrita"
                            >
                              <FiBold size={14} />
                            </button>
                            <button
                              onClick={() => canvas.updateExtraElement(parseInt(slideIdx), elId, { italic: !el.italic })}
                              className={`p-2 rounded-lg transition-all ${
                                el.italic ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                              title="Cursiva"
                            >
                              <FiItalic size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === 'actions' && (
              <div className="p-4 space-y-4">
                {/* Templates Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="w-full flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <FiFolder className="text-indigo-600" />
                      <span className="text-sm font-black text-indigo-600">Mis Plantillas</span>
                    </div>
                    <FiChevronDown className={`transition-transform duration-300 text-indigo-600 ${showTemplates ? 'rotate-180' : ''}`} />
                  </button>

                  {showTemplates && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-[100] overflow-hidden animate-fadeIn">
                      <div className="p-3 border-b border-gray-50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/50">
                        <span className="text-[10px] font-black uppercase text-gray-400">Seleccionar Estilo</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {(() => {
                          const filteredTemplates = canvas.customTemplates?.filter(t => {
                            const isVideoTemplate = t.type === 'video' || t.video_slides || t.name?.toLowerCase().includes('reel');
                            return isVideoMode ? isVideoTemplate : !isVideoTemplate;
                          }) || [];

                          if (filteredTemplates.length === 0) {
                            return (
                              <div className="p-4 text-center text-gray-400 text-xs">
                                No hay plantillas guardadas
                              </div>
                            );
                          }

                          return filteredTemplates.map(t => (
                            <div key={t.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0">
                              {templateToDelete === t.id ? (
                                <div className="space-y-2 animate-fadeIn">
                                  <p className="text-xs font-medium text-red-600 dark:text-red-400 text-center">¿Eliminar plantilla?</p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        canvas.deleteTemplate(t.id);
                                        setTemplateToDelete(null);
                                      }}
                                      className="flex-1 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors"
                                    >
                                      Sí, eliminar
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTemplateToDelete(null);
                                      }}
                                      className="flex-1 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold rounded transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <button 
                                    onClick={() => { 
                                      canvas.applyCustomTemplate(t, totalSlides); 
                                      setShowTemplates(false); 
                                    }}
                                    className="text-left flex-1 mr-2 overflow-hidden"
                                  >
                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate" title={t.name}>{t.name}</p>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTemplateToDelete(t.id);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex-shrink-0"
                                    title="Eliminar plantilla"
                                  >
                                    <FiTrash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Template */}
                {isSavingTemplate ? (
                  <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-800 space-y-2 animate-fadeIn">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Nombre de la plantilla..."
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTemplateName.trim()) {
                          canvas.saveCustomTemplate(newTemplateName.trim(), isVideoMode ? 'video' : 'carousel');
                          setNewTemplateName('');
                          setIsSavingTemplate(false);
                          setShowTemplates(true);
                        } else if (e.key === 'Escape') {
                          setIsSavingTemplate(false);
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border-2 border-green-200 dark:border-green-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-green-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (newTemplateName.trim()) {
                            canvas.saveCustomTemplate(newTemplateName.trim(), isVideoMode ? 'video' : 'carousel');
                            setNewTemplateName('');
                            setIsSavingTemplate(false);
                            setShowTemplates(true);
                          }
                        }}
                        className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setIsSavingTemplate(false)}
                        className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsSavingTemplate(true)}
                    className="w-full flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-xl transition-all"
                  >
                    <FiSave className="text-green-600" />
                    <span className="text-sm font-black text-green-600">Guardar Plantilla</span>
                  </button>
                )}

                {/* Layer Controls */}
                {(selectedElement || canvas.selectedImageId) && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <h3 className="text-xs font-black text-amber-600 uppercase tracking-wider mb-3">Control de Elemento</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          if (selectedElement) {
                            // Handle shape/extra element layer control
                            const [slideIdx, elId] = selectedElement.split('-');
                            const el = canvas.extraElements[slideIdx]?.find(e => e.id === elId);
                            if (el) {
                              canvas.updateExtraElement(parseInt(slideIdx), elId, { 
                                zIndex: el.zIndex === 30 ? 5 : 30 
                              });
                            }
                          } else if (canvas.selectedImageId) {
                            // Handle image layer control
                            const [slideIdx, imgIdx] = canvas.selectedImageId.split('-');
                            const slide = canvas.slides?.[slideIdx];
                            if (slide && slide.images && slide.images[imgIdx]) {
                              const img = slide.images[imgIdx];
                              const newZIndex = img.zIndex === 20 ? 5 : 20;
                              // Update image z-index
                              const updatedImages = [...slide.images];
                              updatedImages[imgIdx] = { ...img, zIndex: newZIndex };
                              const updatedSlides = [...canvas.slides];
                              updatedSlides[slideIdx] = { ...slide, images: updatedImages };
                              canvas.setSlides(updatedSlides);
                            }
                          }
                        }}
                        className="w-full p-2 bg-white dark:bg-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <FiLayers size={14} />
                        {(() => {
                          if (selectedElement) {
                            const [slideIdx, elId] = selectedElement.split('-');
                            const el = canvas.extraElements[slideIdx]?.find(e => e.id === elId);
                            return el?.zIndex === 30 ? 'Enviar al fondo' : 'Traer al frente';
                          } else if (canvas.selectedImageId) {
                            const [slideIdx, imgIdx] = canvas.selectedImageId.split('-');
                            const slide = canvas.slides?.[slideIdx];
                            if (slide && slide.images && slide.images[imgIdx]) {
                              return slide.images[imgIdx].zIndex === 20 ? 'Enviar al fondo' : 'Traer al frente';
                            }
                          }
                          return 'Mover capa';
                        })()}
                      </button>
                      <button
                        onClick={() => {
                          if (selectedElement) {
                            const [slideIdx, elId] = selectedElement.split('-');
                            canvas.removeExtraElement(parseInt(slideIdx), elId);
                          } else if (canvas.selectedImageId) {
                            // Handle image deletion
                            const [slideIdx, imgIdx] = canvas.selectedImageId.split('-');
                            if (onRemoveImage) {
                              onRemoveImage(parseInt(slideIdx), parseInt(imgIdx));
                            }
                          }
                        }}
                        className="w-full p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
                      >
                        <FiTrash2 size={14} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}


              </div>
            )}

            {/* Audio & Settings Tab */}
            {activeTab === 'audio' && isVideoMode && (
              <div className="p-4 space-y-6">
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Pistas de Audio</h3>
                  
                  {/* Toggle Global vs Diapositiva */}
                  <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                    <button
                      onClick={() => setAudioApplyMode('global')}
                      className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                        audioApplyMode === 'global' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Aplicar a todo el video
                    </button>
                    <button
                      onClick={() => setAudioApplyMode('slide')}
                      className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                        audioApplyMode === 'slide' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Solo en esta diapositiva
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {/* None option */}
                    <button
                      onClick={() => audioApplyMode === 'global' ? setGlobalAudio(null) : setSelectedAudio(null)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all flex justify-between items-center ${
                        !(audioApplyMode === 'global' ? globalAudio : selectedAudio) ? 'bg-indigo-50 text-indigo-700 font-bold border-2 border-indigo-500' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2"><FiVolumeX /> Sin Música</span>
                      {!(audioApplyMode === 'global' ? globalAudio : selectedAudio) && <FiCheck className="text-indigo-600" />}
                    </button>
                    {/* Default Tracks */}
                    {Object.entries(AUDIO_TRACKS).map(([name, path]) => (
                      <button
                        key={name}
                        onClick={() => audioApplyMode === 'global' ? setGlobalAudio(name) : setSelectedAudio(name)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all flex justify-between items-center ${
                          (audioApplyMode === 'global' ? globalAudio : selectedAudio) === name ? 'bg-indigo-50 text-indigo-700 font-bold border-2 border-indigo-500' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate"><FiVolume2 className={(audioApplyMode === 'global' ? globalAudio : selectedAudio) === name ? 'text-indigo-500' : 'text-gray-400'} /> {name}</span>
                        {(audioApplyMode === 'global' ? globalAudio : selectedAudio) === name && <FiCheck className="text-indigo-600" />}
                      </button>
                    ))}
                    {/* User Audios */}
                    {userAudios?.map(audio => (
                      <div key={audio.id} className="flex gap-1 mb-2">
                        <button
                          onClick={() => audioApplyMode === 'global' ? setGlobalAudio(`User-${audio.id}`) : setSelectedAudio(`User-${audio.id}`)}
                          className={`flex-1 text-left px-3 py-2 rounded-xl text-sm transition-all flex justify-between items-center ${
                            (audioApplyMode === 'global' ? globalAudio : selectedAudio) === `User-${audio.id}` ? 'bg-indigo-50 text-indigo-700 font-bold border-2 border-indigo-500' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate max-w-[140px]"><FiVolume2 className={(audioApplyMode === 'global' ? globalAudio : selectedAudio) === `User-${audio.id}` ? 'text-indigo-500' : 'text-gray-400'} /> {audio.original_name || audio.name || audio.filename || 'Audio sin nombre'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAudio(audio.id)}
                          className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upload Audio */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <label className={`w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${loadingAudios ? 'bg-gray-50 border-gray-200 text-gray-400' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400'}`}>
                    {loadingAudios ? <FiRefreshCw className="animate-spin" /> : <FiPlusCircle />}
                    <span className="text-xs font-bold uppercase">{loadingAudios ? 'Subiendo...' : 'Subir Audio (MP3)'}</span>
                    <input type="file" className="hidden" accept="audio/mpeg,audio/mp3,audio/wav" onChange={handleUploadAudio} disabled={loadingAudios} />
                  </label>
                  <p className="text-[9px] text-center text-gray-400 mt-2">Formatos soportados: MP3, WAV. Máx 5MB.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Fixed Action Buttons at the bottom */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2 bg-gray-50/50 dark:bg-gray-800/50 mt-auto">
          {!isVideoMode && (
            <button
              onClick={onConvertToVideo}
              className="w-full p-3 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <FiVideo size={16} />
              ✨ Convertir a Video
            </button>
          )}
          <button
            onClick={onDownload}
            disabled={isExporting}
            className="relative w-full p-3 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 overflow-hidden disabled:opacity-80"
          >
            {isExporting && (
              <span 
                className="absolute inset-0 bg-white/20 transition-all duration-300 origin-left"
                style={{ transform: `scaleX(${exportProgress / 100})` }}
              />
            )}
            <span className="relative flex items-center gap-2 z-10">
              {isExporting ? <FiRefreshCw className="animate-spin" size={16} /> : (isVideoMode ? <FiVideo size={16} /> : <FiDownload size={16} />)}
              {isExporting ? `Generando... ${exportProgress}%` : (isVideoMode ? 'Generar MP4' : 'Descargar ZIP')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};


