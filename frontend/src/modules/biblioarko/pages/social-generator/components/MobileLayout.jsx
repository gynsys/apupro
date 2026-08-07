
import React from 'react';
import { 
  FiCpu, FiFolder, FiLoader, FiInstagram, FiImage, FiZap, FiX, FiTrash2, 
  FiChevronLeft, FiChevronRight, FiBold, FiItalic, FiType, FiLayers, FiDownload, FiSave, FiCopy, FiMaximize2, FiPlay, FiPause
} from 'react-icons/fi';
import { SlideCanvas } from './SlideCanvas';
import { MobileToolbar } from './MobileToolbar';


export const MobileLayout = ({
  posts,
  selectedPost,
  setSelectedPost,
  generating,
  generatedContent,
  setGeneratedContent,
  handleGenerate,
  handleTestDesign,
  showProjects,
  setShowProjects,
  designer,
  handleLoadProject,
  activeProjectName,
  isMobileFullscreen,
  exitMobileFullscreen,
  scale,
  doctor,
  doctorLogoBase64,
  transformer,
  watermarkImage,
  handleRemoveSlide,
  handleAddImage,
  handleRemoveImage,
  setEditingIndex,
  setPreviewIndex,
  showToast,
  handleConvertToVideo,
  handleSaveProject,
  handleSaveProjectAs,
  handleSaveTemplate,
  activeProjectId,
  activeTab,
  setActiveTab,
  videoStyles,
  setVideoStyles,
  slideDuration,
  setSlideDuration,
  isPlaying,
  setIsPlaying,
  currentVideoSlide,
  setCurrentVideoSlide,
  selectedAudio,
  setSelectedAudio,
  prelisteningTrack,
  setPrelisteningTrack,
  customAudioUrl,
  setCustomAudioUrl,
  audioRef,
  previewAudioRef,
  exporter,
  isExporting,
  exportProgress,
  handleExportVideo,
  handleAddImageToVideoSlide,
  enterMobileFullscreen,
  exportStatus,
  loadingProjects = false,
  userAudios = [],
  loadingAudios = false,
  handleUploadAudio,
  handleDeleteAudio,
  savingType,
  saveProgress,
  activeMode = 'article',
  setActiveMode = () => {},
  aiForm = {},
  setAiForm = () => {},
  handleAiGenerateSocial = () => {}
}) => {
  const [projectToDelete, setProjectToDelete] = React.useState(null);


  React.useEffect(() => {
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = Math.abs(currentX - startX);
      const diffY = Math.abs(currentY - startY);

      // Interceptar desplazamientos predominantemente horizontales (Pan / Swipe)
      if (diffX > diffY && diffX > 5) {
        // Permitir que los inputs de rango funcionen, pero detener el burbujeo
        // para que WKWebView no capture el gesto de arrastre de pantalla
        if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
          e.stopPropagation();
        } else {
          // Bloquear el pan/swipe lateral nativo del navegador/SO
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      }
    };

    // { passive: false } es CRÍTICO para poder llamar a e.preventDefault() en iOS Safari
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col pb-20 w-full" style={{ touchAction: 'pan-y', overflowX: 'clip', overscrollBehaviorX: 'none', maxWidth: '100vw' }}>
      {/* Compact Mobile Header */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <FiCpu className="text-indigo-600" /> Arko360
          </h1>
          <button 
            onClick={() => setShowProjects(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest border border-indigo-100 dark:border-indigo-800"
          >
            <FiFolder /> Proyectos
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex border-b border-gray-100 dark:border-gray-700 pb-2 mb-2 gap-4">
            <button 
              onClick={() => {
                setActiveMode('article');
                setGeneratedContent(null);
              }}
              className={`pb-1 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 ${activeMode === 'article' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-400'}`}
            >
              Artículo
            </button>
            <button 
              onClick={() => {
                setActiveMode('ai');
                setSelectedPost(null);
                setGeneratedContent(null);
              }}
              className={`pb-1 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1 ${activeMode === 'ai' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-400'}`}
            >
              PDF / Tema <span className="text-[8px] bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded font-black">IA</span>
            </button>
          </div>

          {activeMode === 'article' ? (
            <div className="space-y-2">
              <select
                value={selectedPost?.id || ''}
                onChange={(e) => {
                  setSelectedPost(posts.find(p => p.id === parseInt(e.target.value)));
                  setGeneratedContent(null);
                }}
                className="block w-full rounded-xl border-gray-200 dark:bg-gray-900 dark:text-white py-2 px-3 border text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="" disabled>Elegir artículo...</option>
                {posts.map(post => <option key={post.id} value={post.id}>{post.title}</option>)}
              </select>
              {selectedPost && (
                <div className="animate-fadeIn">
                  <input
                    type="text"
                    value={aiForm?.instructions || ''}
                    onChange={(e) => setAiForm({...aiForm, instructions: e.target.value})}
                    className="block w-full rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white p-2 border text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="Instrucciones especiales (Opcional)"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
              <div>
                <input
                  type="text"
                  value={aiForm?.topic || ''}
                  onChange={(e) => setAiForm({...aiForm, topic: e.target.value})}
                  className="block w-full rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2 border text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Tema (ecografía, SOP, etc.)"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setAiForm({...aiForm, pdf_file: e.target.files[0]})}
                    className="block w-full text-[9px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-indigo-50 dark:file:bg-indigo-900/50 file:text-indigo-700 dark:file:text-indigo-300 border border-gray-200 dark:border-gray-700 rounded-lg p-1 bg-white dark:bg-gray-800"
                  />
                </div>
                <select
                  value={aiForm?.format || 'reel'}
                  onChange={(e) => setAiForm({...aiForm, format: e.target.value})}
                  className="rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white px-2 py-1 border text-[10px] focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value="reel">Reel</option>
                  <option value="carousel">Carrusel</option>
                </select>
              </div>
              <div>
                <input
                  type="text"
                  value={aiForm?.instructions || ''}
                  onChange={(e) => setAiForm({...aiForm, instructions: e.target.value})}
                  className="block w-full rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2 border text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Instrucciones especiales (Opcional)"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleAiGenerateSocial(aiForm)}
                  disabled={generating || (!aiForm?.topic && !aiForm?.pdf_file)}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-white font-black uppercase tracking-wider text-[9px] py-1.5 px-3 rounded-lg transition-all"
                >
                  {generating ? 'Generando...' : 'Generar IA ✨'}
                </button>
              </div>
            </div>
          )}

          {generating && (
            <div className="flex items-center justify-center gap-2 py-3" style={{ color: doctor?.theme_primary_color || '#4F46E5' }}>
              <FiLoader className="animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest">IA procesando...</span>
            </div>
          )}

          {selectedPost && !generatedContent && !generating && (
            <div className="grid grid-cols-3 gap-2 animate-fadeIn">
              <button 
                onClick={() => handleGenerate('reel', aiForm?.instructions)} 
                className="flex items-center justify-center gap-1.5 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-tighter"
              >
                <FiInstagram size={10} /> Reel
              </button>
              <button 
                onClick={() => handleGenerate('carousel', aiForm?.instructions)} 
                className="flex items-center justify-center gap-1.5 py-2 bg-purple-600 text-white rounded-xl text-[9px] font-black uppercase tracking-tighter"
              >
                <FiImage size={10} /> Carrusel
              </button>
              <button 
                onClick={handleTestDesign}
                className="flex items-center justify-center gap-1.5 py-2 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-tighter"
              >
                <FiZap size={10} /> Draft
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Projects Modal */}
      {showProjects && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm animate-fadeIn flex flex-col">
          <div className="mt-auto bg-white dark:bg-gray-800 rounded-t-[40px] shadow-2xl p-6 h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Mis Proyectos</h3>
              <button onClick={() => setShowProjects(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pb-8 no-scrollbar">
              {loadingProjects ? (
                <div className="py-12 text-center flex items-center justify-center gap-2 text-gray-400">
                  <FiLoader className="animate-spin" size={14} />
                  <span className="italic text-sm">Cargando proyectos...</span>
                </div>
              ) : designer.canvas.projects.length === 0 ? (
                <div className="py-12 text-center text-gray-400 italic">No tienes proyectos guardados todavía.</div>
              ) : (
                designer.canvas.projects.map(p => (
                  <div key={p.id} className="p-5 bg-gray-50 dark:bg-gray-900 rounded-3xl flex items-center justify-between border border-gray-100 dark:border-gray-700">
                    {projectToDelete === p.id ? (
                      <div className="w-full space-y-3 animate-fadeIn p-2">
                        <p className="text-xs font-medium text-red-600 dark:text-red-400 text-center">¿Eliminar este proyecto?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await designer.canvas.deleteProject(p.id, p.is_backend);
                              if (ok) showToast('Proyecto eliminado', 'success');
                              setProjectToDelete(null);
                            }}
                            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors"
                          >
                            Sí, eliminar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(null);
                            }}
                            className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => { handleLoadProject(p); setShowProjects(false); }} className="text-left flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-gray-900 dark:text-white">{p.name}</p>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full uppercase font-black tracking-tighter ${p.is_backend ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                              {p.is_backend ? 'Nube' : 'Local'}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Reciente'} - {p.content?.slides?.length || 0} slides
                          </p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(p.id);
                          }}
                          className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-2xl transition-colors"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Switcher for Mobile */}
      {generatedContent && (
        <div className="px-4 mt-4 space-y-3">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
            <button 
              onClick={() => setActiveTab('video')} 
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'video' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
            >
              Reel
            </button>
            <button 
              onClick={() => setActiveTab('carousel')} 
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'carousel' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
            >
              Carrusel
            </button>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleSaveProject} 
              disabled={savingType !== null}
              style={{ backgroundColor: 'rgb(205, 8, 87)' }}
              className="relative flex-1 py-3 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-pink-200/20 active:scale-95 flex items-center justify-center gap-2 overflow-hidden disabled:opacity-80"
            >
              {/* Animated progress bar underlay */}
              {savingType === 'save' && (
                <span 
                  className="absolute inset-0 bg-white/20 transition-all duration-300 origin-left"
                  style={{ transform: `scaleX(${saveProgress / 100})` }}
                />
              )}
              {savingType === 'save' ? (
                <>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3.8" />
                    <circle
                      cx="18" cy="18" r="15.9"
                      fill="none" stroke="white" strokeWidth="3.8"
                      strokeDasharray={`${saveProgress} 100`}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                      style={{ transition: 'stroke-dasharray 0.3s ease' }}
                    />
                  </svg>
                  <span className="relative">{saveProgress}%</span>
                </>
              ) : (
                <><FiSave /> Guardar</>
              )}
            </button>
            <button 
              onClick={handleSaveProjectAs} 
              disabled={savingType !== null}
              className="relative flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 disabled:opacity-80 overflow-hidden"
            >
              {/* Animated progress bar underlay */}
              {savingType === 'saveAs' && (
                <span 
                  className="absolute inset-0 bg-gray-200 dark:bg-gray-600 transition-all duration-300 origin-left"
                  style={{ transform: `scaleX(${saveProgress / 100})` }}
                />
              )}
              {savingType === 'saveAs' ? (
                <>
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3.8" />
                    <circle
                      cx="18" cy="18" r="15.9"
                      fill="none" stroke="currentColor" strokeWidth="3.8"
                      strokeDasharray={`${saveProgress} 100`}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                      style={{ transition: 'stroke-dasharray 0.3s ease' }}
                    />
                  </svg>
                  <span className="relative z-10">{saveProgress}%</span>
                </>
              ) : (
                <><FiSave className="relative z-10" /> <span className="relative z-10">Guardar como...</span></>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Main Area */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
        {!generatedContent ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-[40px] shadow-sm border-2 border-dashed border-gray-100 dark:border-gray-700 text-center p-10 mt-6">
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-3xl flex items-center justify-center text-gray-200 dark:text-gray-700 mb-6">
              <FiZap size={40} />
            </div>
            <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] px-4 leading-relaxed">
              Selecciona un artículo y genera contenido
            </h3>
          </div>
        ) : (
          <div className="w-full flex flex-col space-y-4 animate-fadeIn">
              <div className="w-full flex flex-col items-center justify-center space-y-4 pt-6">
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-4 border border-gray-100 dark:border-gray-700">
                  <div className="w-[300px] h-[300px] bg-gray-50 dark:bg-gray-900 rounded-2xl flex flex-col items-center justify-center text-center p-6 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-all" onClick={enterMobileFullscreen}>
                      <FiMaximize2 className="text-indigo-200 mb-3" size={40} />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Toca para editar {activeTab === 'video' ? 'Reel' : 'Carrusel'}
                      </p>
                  </div>
                </div>
                
                <div className="w-full">
                  <button onClick={() => setPreviewIndex(0)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
                    <FiPlay /> Previa de {activeTab === 'video' ? 'Reel' : 'Carrusel'}
                  </button>
                </div>
              </div>
          </div>
        )}
      </div>

      {/* Mobile Full-Screen Editor */}
      {isMobileFullscreen && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[100] flex flex-col" style={{ touchAction: 'pan-y', overflowX: 'clip', overscrollBehaviorX: 'none' }}>
          <button
            onClick={exitMobileFullscreen}
            className="absolute top-4 right-4 z-[110] p-3 bg-red-500 text-white rounded-full shadow-lg"
          >
            <FiX size={24} />
          </button>

          <div className="flex-1 flex items-center justify-center w-full">
            <div
              className="flex items-center justify-center"
              style={{ width: 410 * scale, height: 410 * scale, perspective: '1000px' }}
            >
              <div id="main-slide-canvas" style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
                <SlideCanvas
                  slide={activeTab === 'video' ? generatedContent?.video_slides?.[designer.canvas.currentSlidePage] : generatedContent?.slides?.[designer.canvas.currentSlidePage]}
                  index={designer.canvas.currentSlidePage}
                  doctor={doctor}
                  doctorLogo={doctorLogoBase64}
                  design={designer.design}
                  canvas={designer.canvas}
                  transform={transformer?.state}
                  handlers={transformer?.handlers}
                  watermark={watermarkImage}
                  onEdit={setEditingIndex}
                  onPreview={setPreviewIndex}
                  onCopy={(i) => {
                    const key = activeTab === 'video' ? 'video_slides' : 'slides';
                    if (!generatedContent?.[key]) return;
                    const newSlides = [...generatedContent[key]];
                    newSlides.splice(i + 1, 0, { ...newSlides[i] });
                    setGeneratedContent({ ...generatedContent, [key]: newSlides });
                    showToast('Diapositiva duplicada', 'success');
                  }}
                  onRemove={handleRemoveSlide}
                  onAddImage={(e) => handleAddImage(designer.canvas.currentSlidePage, e)}
                  onRemoveImage={(imgIndex) => handleRemoveImage(designer.canvas.currentSlidePage, imgIndex)}
                  isVideoMode={activeTab === 'video'}
                />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="fixed bottom-24 left-0 right-0 z-[110] flex justify-center px-4">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-full shadow-lg border border-gray-100 dark:border-gray-700 p-1 flex items-center gap-4">
              <button
                onClick={() => designer.canvas.setCurrentSlidePage(Math.max(0, designer.canvas.currentSlidePage - 1))}
                disabled={designer.canvas.currentSlidePage === 0}
                className={`p-3 rounded-full transition-all ${designer.canvas.currentSlidePage === 0 ? 'text-gray-300' : 'text-indigo-600 active:scale-90'}`}
              >
                <FiChevronLeft size={24} />
              </button>
              <div className="flex flex-col items-center min-w-[60px]">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Diapositiva</span>
                <span className="text-sm font-black text-indigo-600 leading-none">
                  {designer.canvas.currentSlidePage + 1} <span className="text-gray-300 mx-0.5">/</span> {activeTab === 'video' ? (generatedContent?.video_slides?.length || 0) : (generatedContent?.slides?.length || 0)}
                </span>
              </div>
              <button
                onClick={() => designer.canvas.setCurrentSlidePage(Math.min(((activeTab === 'video' ? generatedContent?.video_slides?.length : generatedContent?.slides?.length) || 1) - 1, designer.canvas.currentSlidePage + 1))}
                disabled={designer.canvas.currentSlidePage === ((activeTab === 'video' ? generatedContent?.video_slides?.length : generatedContent?.slides?.length) || 1) - 1}
                className={`p-3 rounded-full transition-all ${designer.canvas.currentSlidePage === ((activeTab === 'video' ? generatedContent?.video_slides?.length : generatedContent?.slides?.length) || 1) - 1 ? 'text-gray-300' : 'text-indigo-600 active:scale-90'}`}
              >
                <FiChevronRight size={24} />
              </button>
            </div>
            
            {activeTab === 'video' && (
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-4 rounded-full transition-all ${isPlaying ? 'bg-amber-100 text-amber-600' : 'bg-indigo-600 text-white'} active:scale-90 shadow-xl`}
              >
                {isPlaying ? <FiPause size={24} /> : <FiPlay size={24} />}
              </button>
            )}
          </div>

          {/* Mobile Toolbar */}
          {!(designer.canvas.selectedExtraId || designer.canvas.selectedImageId) && (
            <MobileToolbar
              canvas={designer.canvas}
              design={designer.design}
              transform={transformer}
              selectedElement={designer.canvas.selectedExtraId || designer.canvas.selectedImageId}
              onAddElement={(slideIndex, type, content) => {
                designer.canvas.addExtraElement(slideIndex, type, content);
              }}
              onDeleteElement={() => {
                if (designer.canvas.selectedExtraId) {
                  const [slideIdx, elId] = designer.canvas.selectedExtraId.split('-');
                  designer.canvas.removeExtraElement(parseInt(slideIdx), elId);
                } else if (designer.canvas.selectedImageId) {
                  const [slideIdx, imgIdx] = designer.canvas.selectedImageId.split('-');
                  handleRemoveImage(parseInt(slideIdx), parseInt(imgIdx));
                  designer.canvas.setSelectedImageId(null);
                }
              }}
              onDownload={activeTab === 'video' ? handleExportVideo : exporter?.downloadCarousel || (() => {})}
              isVideoMode={activeTab === 'video'}
              selectedAudio={selectedAudio} setSelectedAudio={setSelectedAudio}
              userAudios={userAudios} loadingAudios={loadingAudios}
              handleUploadAudio={handleUploadAudio} handleDeleteAudio={handleDeleteAudio}
              slideDuration={slideDuration} setSlideDuration={setSlideDuration}
              onSave={handleSaveProject}
              onSaveAs={handleSaveProjectAs}
              onSaveTemplate={handleSaveTemplate}
              onPreview={() => setPreviewIndex(0)}
              currentSlide={designer.canvas.currentSlidePage}
              activeProjectName={activeProjectName}
              onConvertToVideo={handleConvertToVideo}
            />
          )}

          {/* Contextual controls placeholder - we'll extract this next */}
          {designer.canvas.selectedExtraId && (() => {
            const [slideIdx, elId] = designer.canvas.selectedExtraId.split('-');
            const el = designer.canvas.extraElements[slideIdx]?.find(e => e.id === elId);
            if (!el || el.type === 'image') return null;
            return (
              <div
                data-contextual-bar="true"
                className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-[150] p-3 pb-safe shadow-xl"
              >
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                   {/* We'll move this content to ContextualBar.jsx later */}
                   <button className="p-3 bg-red-50 text-red-500 rounded-2xl" onClick={() => designer.canvas.removeExtraElement(parseInt(slideIdx), elId)}>
                      <FiTrash2 size={20} />
                   </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};


