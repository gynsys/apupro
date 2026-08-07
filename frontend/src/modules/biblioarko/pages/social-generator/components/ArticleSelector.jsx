
import React from 'react';
import { FiCpu, FiInstagram, FiImage, FiZap, FiFolder, FiChevronDown } from 'react-icons/fi';
import { ProjectGrid } from './ProjectGrid';

export const ArticleSelector = ({
  posts,
  selectedPost,
  setSelectedPost,
  setGeneratedContent,
  showProjects,
  setShowProjects,
  handleGenerate,
  handleTestDesign,
  generating,
  projects,
  loadingProjects = false,
  onLoadProject,
  onDeleteProject,
  activeProjectId,
  activeMode = 'article',
  setActiveMode = () => {},
  aiForm = {},
  setAiForm = () => {},
  handleAiGenerateSocial = () => {},
  primaryColor = '#4F46E5',
  generatedContent,
  handleStartFromScratch
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: Article Selection / AI Generation */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col">
          <div className="flex border-b border-gray-100 dark:border-gray-700 pb-3 mb-4 gap-4">
            <button 
              onClick={() => {
                setActiveMode('article');
                setGeneratedContent(null);
              }}
              className={`pb-1.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${activeMode === 'article' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
            >
              Desde Artículo
            </button>
            <button 
              onClick={() => {
                setActiveMode('ai');
                setSelectedPost(null);
                setGeneratedContent(null);
              }}
              className={`pb-1.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${activeMode === 'ai' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
            >
              Desde PDF o Tema <span className="text-[9px] bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-black">IA</span>
            </button>
            <button 
              onClick={handleStartFromScratch}
              className={`pb-1.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${activeMode === 'scratch' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
            >
              Nuevo <span className="text-[9px] bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-black">PROYECTO</span>
            </button>
          </div>

          {activeMode === 'scratch' ? null : activeMode === 'article' ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Seleccionar Artículo</h2>
                <select
                  value={selectedPost?.id || ''}
                  onChange={(e) => {
                    setSelectedPost(posts.find(p => p.id === parseInt(e.target.value)));
                    setGeneratedContent(null);
                  }}
                  className="block w-full rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white p-3 border font-manrope focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm"
                >
                  <option value="" disabled>Elegir artículo...</option>
                  {posts.map(post => <option key={post.id} value={post.id}>{post.title}</option>)}
                </select>
              </div>

              {selectedPost && (
                <div className="animate-fadeIn">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Instrucciones Especiales / Indicaciones de Ajuste (Opcional)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiForm?.instructions || ''}
                      onChange={(e) => setAiForm({...aiForm, instructions: e.target.value})}
                      className="block flex-1 rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white p-2.5 border text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Ej: Amplía la explicación de las diapositivas 2 y 4"
                    />
                    {aiForm?.instructions && aiForm.instructions.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAiGenerateSocial(aiForm)}
                        disabled={generating}
                        className="flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:bg-gray-200 text-white font-black uppercase tracking-wider text-[10px] py-2.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap"
                      >
                        <FiZap size={12} className="animate-pulse" />
                        Aplicar Ajustes
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Tema / Título del Contenido</label>
                  <input
                    type="text"
                    value={aiForm?.topic || ''}
                    onChange={(e) => setAiForm({...aiForm, topic: e.target.value})}
                    className="block w-full rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white p-2.5 border text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ej: Prevención del VPH en jóvenes"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Adjuntar PDF de Referencia</label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setAiForm({...aiForm, pdf_file: e.target.files[0]})}
                    className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-indigo-50 dark:file:bg-indigo-900/50 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 border border-gray-200 dark:border-gray-700 rounded-xl p-1 bg-white dark:bg-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Formato Social</label>
                  <select
                    value={aiForm?.format || 'reel'}
                    onChange={(e) => setAiForm({...aiForm, format: e.target.value})}
                    className="block w-full rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white p-2.5 border text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="reel">Reel / Video IA</option>
                    <option value="carousel">Carrusel Técnico</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Tono del Mensaje</label>
                  <select
                    value={aiForm?.tone || 'Profesional'}
                    onChange={(e) => setAiForm({...aiForm, tone: e.target.value})}
                    className="block w-full rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white p-2.5 border text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option>Profesional</option>
                    <option>Empático</option>
                    <option>Informativo</option>
                    <option>Directo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Instrucciones Especiales / Indicaciones de Ajuste (Opcional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiForm?.instructions || ''}
                    onChange={(e) => setAiForm({...aiForm, instructions: e.target.value})}
                    className="block flex-1 rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white p-2.5 border text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ej: Amplía la explicación de las diapositivas 2 y 4"
                  />
                  {aiForm?.instructions && aiForm.instructions.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAiGenerateSocial(aiForm)}
                      disabled={generating}
                      className="flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:bg-gray-200 text-white font-black uppercase tracking-wider text-[10px] py-2.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap"
                    >
                      <FiZap size={12} className="animate-pulse" />
                      Aplicar Ajustes
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleAiGenerateSocial(aiForm)}
                  disabled={generating || (!aiForm?.topic && !aiForm?.pdf_file)}
                  className="flex items-center gap-1.5 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-white font-black uppercase tracking-wider text-[10px] py-2.5 px-4 rounded-xl transition-all shadow-md"
                  style={!generating && (aiForm?.topic || aiForm?.pdf_file) ? { backgroundColor: primaryColor } : {}}
                >
                  {generating ? (
                    <>
                      <div
                        className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30"
                        style={{ borderTopColor: 'white' }}
                      />
                      Generando Contenido...
                    </>
                  ) : (
                    <>
                      <FiCpu size={14} />
                      Crear Contenido con IA ✨
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Saved Projects Access */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 h-fit">
          <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-4">Continuar Proyecto Guardado</h2>
          <div className="relative">
            <button 
              onClick={() => setShowProjects(!showProjects)}
              className="flex items-center justify-between w-full px-5 py-3 bg-indigo-50 dark:bg-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-xl border border-indigo-100 dark:border-indigo-700 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <FiFolder className="text-indigo-500" />
                <span className="text-sm font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-tight">Mis Proyectos Guardados</span>
              </div>
              <FiChevronDown className={`text-indigo-600 transition-transform ${showProjects ? 'rotate-180' : ''}`} />
            </button>

            {/* Proyectos desplegables aquí para correcto posicionamiento absolute */}
            {showProjects && (
              <ProjectGrid 
                projects={projects}
                onLoad={onLoadProject}
                onDelete={onDeleteProject}
                activeProjectId={activeProjectId}
                variant="compact"
                loading={loadingProjects}
              />
            )}
          </div>
        </div>
      </div>

      {/* Step 3: Generation Options */}
      {selectedPost && !generating && !generatedContent && (
        <div className="bg-indigo-600 rounded-[32px] p-1 flex flex-col md:flex-row shadow-xl shadow-indigo-100 dark:shadow-none animate-fadeIn">
          <button 
            onClick={() => handleGenerate('reel', aiForm?.instructions)}
            className="flex-1 flex items-center justify-center gap-3 py-6 px-8 text-white hover:bg-white/10 rounded-[30px] transition-all group"
          >
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FiInstagram size={24} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Generar Video</p>
                {!!selectedPost?.pregenerated_reel && !aiForm?.instructions && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider animate-pulse flex items-center gap-0.5">
                    <FiZap size={10} className="fill-emerald-300" /> Listo
                  </span>
                )}
              </div>
              <p className="text-lg font-black uppercase tracking-tight">Arko360 Reel IA</p>
            </div>
          </button>
          
          <div className="w-px bg-white/10 hidden md:block"></div>
          
          <button 
            onClick={() => handleGenerate('carousel', aiForm?.instructions)}
            className="flex-1 flex items-center justify-center gap-3 py-6 px-8 text-white hover:bg-white/10 rounded-[30px] transition-all group"
          >
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FiImage size={24} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Generar Diseño</p>
                {!!selectedPost?.pregenerated_carousel && !aiForm?.instructions && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider animate-pulse flex items-center gap-0.5">
                    <FiZap size={10} className="fill-emerald-300" /> Listo
                  </span>
                )}
              </div>
              <p className="text-lg font-black uppercase tracking-tight">Carrusel Técnico</p>
            </div>
          </button>

          <div className="w-px bg-white/10 hidden md:block"></div>

          <button 
            onClick={handleTestDesign}
            className="flex-1 flex items-center justify-center gap-3 py-6 px-8 text-indigo-100 hover:bg-white/10 rounded-[30px] transition-all group"
          >
            <div className="w-12 h-12 bg-amber-400/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform text-amber-400">
              <FiZap size={24} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Diseño Libre</p>
              <p className="text-lg font-black uppercase tracking-tight">Modo Boceto</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};


