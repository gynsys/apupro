
import React, { useState, useEffect, useRef } from 'react';
import { FiCpu, FiInstagram, FiLoader, FiFolder, FiZap, FiVideo, FiImage, FiSave, FiX, FiPlay, FiPause, FiChevronLeft, FiChevronRight, FiAlignLeft, FiAlignCenter, FiAlignRight, FiBold, FiItalic, FiList, FiFilePlus, FiGrid } from 'react-icons/fi';

// Config & Services
import { blogService } from '../../services/blogService';
import { API_URL } from '../../../../services/api';
const ArkoLoader = () => <div className="p-8 text-center">Cargando...</div>;;
import toast from 'react-hot-toast';;
const getImageUrl = (url) => url;;
const useAuthStore = () => ({ user: { id: 1 } });;
import { AUDIO_TRACKS, DEFAULT_VIDEO_STYLES } from './constants';

// Hooks
import { useSlideDesigner } from './hooks/useSlideDesigner';
import { useDragTransform } from './hooks/useDragTransform';
import { useExport } from './hooks/useExport';
import { useVideoExport } from './hooks/useVideoExport';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { useVideoPlayback } from './hooks/useVideoPlayback';
import { useMobileFullscreen } from './hooks/useMobileFullscreen';

// Components
import { SlideCanvas } from './components/SlideCanvas';
import { SlidePaginator } from './components/SlidePaginator';
import { PreviewModal } from './components/PreviewModal';
import { EnhancedSidebar } from './components/EnhancedSidebar';
import { TimelinePanel } from './components/TimelinePanel';
import { ImageCropperModal } from './components/ImageCropperModal';

const Modal = ({ isOpen, onClose, title, children }) => isOpen ? (<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"><div className="bg-white p-6 rounded-lg"><h2>{title}</h2>{children}<button onClick={onClose}>Cerrar</button></div></div>) : null;

import { MobileLayout } from './components/MobileLayout';
import { ArticleSelector } from './components/ArticleSelector';
import { ProjectGrid } from './components/ProjectGrid';
import { ContextualBar } from './components/ContextualBar';
import VideoEditorModal from './components/VideoEditorModal';

export default function SocialGenerator() {
  // --- States ---
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [activeMode, setActiveMode] = useState('article'); // 'article' | 'ai'
  const [aiForm, setAiForm] = useState({
    topic: '',
    pdf_file: null,
    tone: 'Profesional',
    format: 'reel'
  });
  const [generatedContent, setGeneratedContent] = useState(null);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('socialGenTab') || 'video');
  const [activeProjectName, setActiveProjectName] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showBgImage, setShowBgImage] = useState(true);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const [saveAsProjectName, setSaveAsProjectName] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [watermarkImage, setWatermarkImage] = useState(null);
  const [doctorLogoBase64, setDoctorLogoBase64] = useState(null);
  const [videoTime, setVideoTime] = useState(0);
  
  const [pendingVideoFile, setPendingVideoFile] = useState(null);
  const [pendingVideoTarget, setPendingVideoTarget] = useState(null);
  const [history, setHistory] = useState([]);
  const [scale, setScale] = useState(1);
  const [videoStyles, setVideoStyles] = useState(DEFAULT_VIDEO_STYLES);
  const [slideDuration, setSlideDuration] = useState(3);
  const [transitionType, setTransitionType] = useState('fade');
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [savingType, setSavingType] = useState(null); // 'save' | 'saveAs' | null
  const [saveProgress, setSaveProgress] = useState(0);
  const [lastGeneratedBlogContent, setLastGeneratedBlogContent] = useState(null);
  const saveProgressRef = useRef(null);
  const [siteConfig, setSiteConfig] = useState(null);
  
  const [cropModalData, setCropModalData] = useState({ isOpen: false, slideIdx: null, imgIdx: null, imageUrl: null });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${API_URL}/arko/config`);
        if (response.ok) {
           const data = await response.json();
           setSiteConfig(data);
        }
      } catch (err) {
        console.error('Error fetching config:', err);
      }
    };
    fetchConfig();
  }, []);

  // --- Refs ---
  const editorWrapperRef = useRef(null);
  const mobileEditorWrapperRef = useRef(null);
  const imagePositionsRef = useRef({});

  // --- External Stores ---
  const showToast = (msg, type) => type === 'error' ? toast.error(msg) : toast.success(msg);
  const { user: doctor } = useAuthStore();

  // --- Custom Hooks ---
  const designer = useSlideDesigner();
  
  const { isPlaying, setIsPlaying, currentVideoSlide, setCurrentVideoSlide } = useVideoPlayback(
    activeTab, generatedContent, false, slideDuration
  );

  // Sync video playback slide with canvas
  useEffect(() => {
    if (activeTab === 'carousel' && isPlaying) setIsPlaying(false);
  }, [activeTab]);

  const activeSlideIdx = isPlaying 
    ? currentVideoSlide 
    : (designer.canvas?.currentSlidePage !== undefined ? designer.canvas.currentSlidePage : currentVideoSlide);

  const currentVideoSlideData = activeTab === 'video' ? (generatedContent?.video_slides?.[activeSlideIdx] || {}) : {};
  const selectedAudio = currentVideoSlideData.audio || null;
  const customAudioUrl = currentVideoSlideData.customAudioUrl || null;
  
  // Nuevo estado para la Dualidad Global vs Diapositiva
  const [audioApplyMode, setAudioApplyMode] = useState('global');
  const globalAudio = generatedContent?.videoSettings?.globalAudio || null;
  const globalCustomAudioUrl = generatedContent?.videoSettings?.globalCustomAudioUrl || null;

  const setGlobalAudio = (val) => {
    if (activeTab !== 'video') return;
    const newSettings = { ...(generatedContent?.videoSettings || {}), globalAudio: val };
    setGeneratedContent({ ...generatedContent, videoSettings: newSettings });
  };
  const setGlobalCustomAudioUrl = (val) => {
    if (activeTab !== 'video') return;
    const newSettings = { ...(generatedContent?.videoSettings || {}), globalCustomAudioUrl: val };
    setGeneratedContent({ ...generatedContent, videoSettings: newSettings });
  };

  const setSelectedAudio = (val) => {
    if (activeTab !== 'video' || !generatedContent?.video_slides) return;
    const newSlides = [...generatedContent.video_slides];
    const targetIdx = activeSlideIdx < newSlides.length ? activeSlideIdx : 0;
    newSlides[targetIdx] = { ...newSlides[targetIdx], audio: val };
    setGeneratedContent({ ...generatedContent, video_slides: newSlides });
  };
  
  const setCustomAudioUrl = (val) => {
    if (activeTab !== 'video' || !generatedContent?.video_slides) return;
    const newSlides = [...generatedContent.video_slides];
    const targetIdx = activeSlideIdx < newSlides.length ? activeSlideIdx : 0;
    newSlides[targetIdx] = { ...newSlides[targetIdx], customAudioUrl: val };
    setGeneratedContent({ ...generatedContent, video_slides: newSlides });
  };

  const { 
    audioRef, globalAudioRef, previewAudioRef, prelisteningTrack, setPrelisteningTrack, 
    getActiveAudioSrc, userAudios, loadingAudios, handleUploadAudio, handleDeleteAudio,
    volume, setVolume
  } = useAudioPlayback(
    activeTab, isPlaying, setIsPlaying, showToast,
    selectedAudio, setSelectedAudio, customAudioUrl, setCustomAudioUrl, currentVideoSlide,
    globalAudio, setGlobalAudio, globalCustomAudioUrl, setGlobalCustomAudioUrl, audioApplyMode
  );

  useEffect(() => {
    let interval;
    if (isPlaying && activeTab === 'video') {
      interval = setInterval(() => {
        setVideoTime(prev => {
          const nextTime = prev + 0.1;

          let maxVidDur = slideDuration;
          const slide = generatedContent?.video_slides?.[currentVideoSlide];
          
          if (slide) {
            const tEnd = slide.titleEndTime !== undefined ? slide.titleEndTime : slideDuration;
            const cEnd = slide.contentEndTime !== undefined ? slide.contentEndTime : slideDuration;
            if (tEnd > maxVidDur) maxVidDur = tEnd;
            if (cEnd > maxVidDur) maxVidDur = cEnd;
            if (slide.audioEndTime !== undefined && slide.audioEndTime > maxVidDur) maxVidDur = slide.audioEndTime;
            
            const extraElements = designer.canvas.extraElements[currentVideoSlide] || [];
            extraElements.forEach(el => {
              if (el.endTime !== undefined && el.endTime > maxVidDur) maxVidDur = el.endTime;
            });
            
            if (slide.customImages) {
              slide.customImages.forEach((img, imgIdx) => {
                const imgId = `${currentVideoSlide}-${imgIdx}`;
                const pos = imagePositionsRef.current?.[imgId] || {};
                const endT = pos.endTime !== undefined ? pos.endTime : slideDuration;
                if (endT > maxVidDur) maxVidDur = endT;
              });
            }
          }

          // Sync Audio with Timeline
          if (audioRef?.current) {
            if (slide && slide.audio) {
              const aStart = slide.audioStartTime !== undefined ? slide.audioStartTime : 0;
              const aEnd = slide.audioEndTime !== undefined ? slide.audioEndTime : maxVidDur;
              
              if (nextTime >= aStart && nextTime <= aEnd) {
                if (audioRef.current.paused) {
                  audioRef.current.play().catch(e => console.log('Audio sync play error', e));
                }
              } else {
                if (!audioRef.current.paused) {
                  audioRef.current.pause();
                }
              }
            } else {
                if (!audioRef.current.paused) audioRef.current.pause();
            }
          }
          
          if (globalAudioRef?.current) {
            if (globalAudio) {
                if (globalAudioRef.current.paused) globalAudioRef.current.play().catch(e => console.log('Global audio sync play error', e));
            } else {
                if (!globalAudioRef.current.paused) globalAudioRef.current.pause();
            }
          }

          if (nextTime >= maxVidDur) {
            setIsPlaying(false);
            return 0;
          }

          return nextTime;
        });
      }, 100);
    } else {
      setVideoTime(0);
      if (audioRef?.current && !audioRef.current.paused) audioRef.current.pause();
      if (globalAudioRef?.current && !globalAudioRef.current.paused) globalAudioRef.current.pause();
    }
    return () => clearInterval(interval);
  }, [isPlaying, activeTab, slideDuration, currentVideoSlide, generatedContent, audioRef, globalAudioRef, globalAudio]);

  const handleUpdateTiming = (trackId, start, end) => {
    if (!generatedContent) return;
    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
    const newSlides = [...generatedContent[slidesProp]];
    const slide = newSlides[designer.canvas.currentSlidePage];
    
    if (trackId === 'title') {
      slide.titleStartTime = start;
      slide.titleEndTime = end;
    } else if (trackId === 'content') {
      slide.contentStartTime = start;
      slide.contentEndTime = end;
    } else if (trackId === 'audio') {
      slide.audioStartTime = start;
      slide.audioEndTime = end;
    } else if (trackId.startsWith('custom-')) {
      const id = trackId.replace('custom-', '');
      const txt = slide.customTexts?.find(t => t.id === id);
      if (txt) {
        txt.startTime = start;
        txt.endTime = end;
      }
    } else if (trackId.startsWith('extra-')) {
      const id = trackId.replace('extra-', '');
      // Update extra element using the hook
      designer.canvas.updateExtraElement(designer.canvas.currentSlidePage, id, { startTime: start, endTime: end });
    } else if (trackId.startsWith('img-')) {
      const id = trackId.replace('img-', '');
      // id has the format `sIdx-imgIdx`, e.g., '0-0'
      transformer.handlers.updateImage(id, { startTime: start, endTime: end });
      // Skip setGeneratedContent since we're updating transformer state
      return;
    }
    setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
  };

  useEffect(() => {
    if (activeTab === 'video') {
      designer.canvas.setCurrentSlidePage(currentVideoSlide);
    }
  }, [currentVideoSlide, activeTab]);

  useEffect(() => {
    setEditingIndex(null);
    designer.canvas.setCurrentSlidePage(0);
  }, [activeTab]);



  const { isMobileFullscreen, enterMobileFullscreen, exitMobileFullscreen } = useMobileFullscreen(
    isMobile, generatedContent
  );

  const transformer = useDragTransform(designer.canvas.updateExtraElement, scale, {
    setLogoPos: designer.design.setLogoPos,
    setDoctorNamePos: designer.design.setDoctorNamePos,
    setDividerPos: designer.design.setDividerPos
  });

  // Keep imagePositionsRef in sync so the play interval always reads the latest values
  useEffect(() => {
    imagePositionsRef.current = transformer.state.imagePositions;
  }, [transformer.state.imagePositions]);

  const { isExporting, exportProgress, handleExportVideo, exportStatus } = useVideoExport(
    generatedContent, videoStyles, slideDuration, transitionType, transitionDuration, selectedPost, audioRef, globalAudioRef, getActiveAudioSrc, showToast,
    designer, transformer.state
  );

  // Exponer helper de prueba rápida en la consola F12
  useEffect(() => {
    window.testVideoExport = async () => {
      console.log('🧪 === INICIANDO PRUEBA RÁPIDA DE EXPORTACIÓN MP4 ===');
      console.time('⏱️ Tiempo de Exportación');
      const start = performance.now();
      try {
        await handleExportVideo();
        const duration = ((performance.now() - start) / 1000).toFixed(2);
        console.log(`✅ PRUEBA COMPLETADA EXITOSAMENTE en ${duration} segundos.`);
      } catch (err) {
        console.error('❌ ERROR EN PRUEBA DE EXPORTACIÓN:', err);
      }
      console.timeEnd('⏱️ Tiempo de Exportación');
    };
  }, [handleExportVideo]);

  const exporter = useExport(selectedPost, designer, generatedContent);

  // --- Initial Data Load ---
  useEffect(() => {
    loadPosts();
    if (doctor?.logo_url) {
      fetchLogoAsBase64();
    }
  }, [doctor?.id, doctor?.logo_url]);

  // --- Responsive Logic ---
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const handleResize = (width, height) => {
      let s;
      if (activeTab === 'video') {
        s = Math.min(1, (width - 20) / 410, (height - 50) / 728);
      } else {
        s = Math.min(1, (width - 50) / 410);
      }
      setScale(Math.max(0.4, s));
    };

    const ro = new ResizeObserver((entries) => {
      for (let entry of entries) handleResize(entry.contentRect.width, entry.contentRect.height);
    });

    if (editorWrapperRef.current) ro.observe(editorWrapperRef.current);
    if (mobileEditorWrapperRef.current) ro.observe(mobileEditorWrapperRef.current);

    return () => {
      window.removeEventListener('resize', checkMobile);
      ro.disconnect();
    };
  }, []);

  // --- Handlers ---
  const loadPosts = async () => {
    try {
      setLoading(true);
      const data = await blogService.getMyPosts();
      setPosts(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast('Error al cargar artículos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogoAsBase64 = async () => {
    try {
      const url = getImageUrl(doctor.logo_url);
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => setDoctorLogoBase64(reader.result);
      reader.readAsDataURL(blob);
    } catch (e) {
      setDoctorLogoBase64(getImageUrl(doctor.logo_url));
    }
  };

  const pushToHistory = (content) => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(content))]);
  };

  const handleGenerate = async (genType, instructions = null) => {
    if (!selectedPost) {
      showToast('Selecciona un artículo primero', 'error');
      return;
    }
    setGenerating(true);
    try {
      const result = await blogService.generateSocialContent(selectedPost.id, genType, instructions, generatedContent);
      console.log(`[Arko360] AI Result (${genType}):`, result);
      
      setGeneratedContent(result);
      setCurrentVideoSlide(0);
      // REPARACIÓN: Soporte robusto para 'reel', 'video' o 'carousel'
      if (genType === 'carousel') {
        setActiveTab('carousel');
      } else {
        setActiveTab('video');
      }
      setSelectedAudio(null);
      setCustomAudioUrl(null);
      showToast(`${genType === 'carousel' ? 'Carrusel' : 'Video'} generado con éxito`, 'success');
    } catch (error) {
      console.error('Error generating content:', error);
      showToast('Error al generar contenido con IA', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleAiGenerateSocial = async (aiFormOptions) => {
    setGenerating(true);
    try {
      let blogContent = lastGeneratedBlogContent;
      
      const hasTopicChanged = aiFormOptions.topic !== aiForm?.topic || aiFormOptions.pdf_file !== aiForm?.pdf_file;
      const isRefinementOnly = aiFormOptions.instructions && !hasTopicChanged && lastGeneratedBlogContent;

      if (!isRefinementOnly) {
        showToast('Generando contenido base con IA...', 'info');
        blogContent = await blogService.generateAI({
          topic: aiFormOptions.topic,
          pdf_file: aiFormOptions.pdf_file,
          tone: aiFormOptions.tone || 'Profesional',
          target_audience: 'Arquitectos e Ingenieros',
          max_words: 500
        });
        setLastGeneratedBlogContent(blogContent);
      } else {
        showToast('Aplicando mejoras al contenido social...', 'info');
      }
      
      showToast('Estructurando formato social...', 'info');
      
      const result = await blogService.generateSocialFromContent(
        blogContent.title || aiFormOptions.topic || 'Mi Contenido',
        blogContent.generated_content,
        aiFormOptions.format || 'reel',
        aiFormOptions.instructions || null,
        generatedContent
      );
      
      setGeneratedContent(result);
      setCurrentVideoSlide(0);
      
      if (aiFormOptions.format === 'carousel') {
        setActiveTab('carousel');
      } else {
        setActiveTab('video');
      }
      setSelectedAudio(null);
      setCustomAudioUrl(null);
      
      showToast('¡Contenido social creado con éxito!', 'success');
    } catch (error) {
      console.error('[Arko360] Error in handleAiGenerateSocial:', error);
      showToast(error.response?.data?.detail || 'Error al generar contenido con IA', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleConvertToVideo = async () => {
    if (!generatedContent?.slides) return;
    setGenerating(true);
    try {
      const carouselText = generatedContent.slides.map(s => `${s.title}\n${s.content}`).join('\n\n');
      const title = activeProjectName || selectedPost?.title || 'Mi Video';
      const result = await blogService.generateSocialFromContent(title, carouselText, 'video');
      setGeneratedContent(prev => ({ ...prev, video_slides: result.video_slides, music_suggestion: result.music_suggestion, type: 'video' }));
      setActiveTab('video');
      setCurrentVideoSlide(0);
      showToast('¡Carrusel convertido a video!', 'success');
    } catch (error) {
      showToast('Error al convertir a video', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadProject = async (projectInfo) => {
    try {
      showToast('Cargando proyecto...', 'info');
      let fullProject = projectInfo;
      if (projectInfo.is_backend && !projectInfo.content) {
        // Fetch full project data from backend (lazy loading)
        fullProject = await blogService.getCarouselProjectById(projectInfo.id);
        fullProject.is_backend = true;
      }
      
      const content = designer.canvas.loadProject(fullProject);
      if (content) {
        if (content.videoSettings && content.video_slides) {
          // En lugar de sobrescribir el audio de cada slide con el global, dejamos que el global sea independiente
          // Si el usuario traía audios viejos donde selectedAudio era el global, migrarlos a globalAudio
          if (content.videoSettings.selectedAudio && !content.videoSettings.globalAudio) {
            content.videoSettings.globalAudio = content.videoSettings.selectedAudio;
          }
          
          content.video_slides = content.video_slides.map((slide, i) => ({
            ...slide,
            duration: slide.duration || content.videoSettings.slideDuration || 2,
            // Mantener el audio de la slide si existe, sino no heredar el global (ya que ahora son paralelos)
            audio: slide.audio || null,
            customAudioUrl: slide.customAudioUrl || null,
            videoStyles: slide.videoStyles || content.videoSettings.videoStyles || null,
            pos: slide.pos || { scale: 1, x: 0, y: 0, cropStart: 0, cropEnd: null }
          }));
        }
      setGeneratedContent(content);
      if (content.transformerState) {
        transformer.loadState(content.transformerState);
      } else {
        transformer.loadState({});
      }
      if (content.videoSettings) {
        if (content.videoSettings.videoStyles) setVideoStyles(content.videoSettings.videoStyles);
        if (content.videoSettings.slideDuration) setSlideDuration(content.videoSettings.slideDuration);
        setActiveTab(content.type === 'video' || content.video_slides ? 'video' : 'carousel');
      } else {
        setActiveTab('carousel');
      }
      if (content.showBgImage !== undefined) {
        setShowBgImage(content.showBgImage);
      }
      setIsPlaying(false);
      setActiveProjectName(fullProject.name || null);
      setActiveProjectId(fullProject.id || null);
      showToast(`Proyecto "${fullProject.name}" cargado`, 'success');
      }
    } catch (err) {
      console.error('[Arko360] Error al cargar proyecto:', err);
      showToast('Error al cargar el proyecto', 'error');
    }
  };

  const startSaveProgress = () => {
    setSaveProgress(0);
    let current = 0;
    saveProgressRef.current = setInterval(() => {
      current += Math.random() * 15 + 5; // avance aleatorio entre 5-20%
      if (current >= 90) { current = 90; clearInterval(saveProgressRef.current); }
      setSaveProgress(Math.round(current));
    }, 200);
  };

  const stopSaveProgress = (success = true) => {
    clearInterval(saveProgressRef.current);
    setSaveProgress(success ? 100 : 0);
    setTimeout(() => { setSavingType(null); setSaveProgress(0); }, 600);
  };

  const handleNewProject = () => {
    if (window.confirm('¿Estás seguro de que quieres iniciar un nuevo proyecto? Los cambios no guardados se perderán.')) {
      setGeneratedContent(null);
      setActiveProjectName(null);
      setActiveProjectId(null);
      setSelectedPost(null);
      setHistory([]);
      setVideoStyles(DEFAULT_VIDEO_STYLES);
      setSlideDuration(3);
      setTransitionType('fade');
      setTransitionDuration(0.5);
      designer.canvas.setExtraElements({});
      designer.canvas.setCurrentSlidePage(0);
      designer.design.setTitleColor('#000000');
      designer.design.setContentColor('#000000');
      designer.design.setHeaderColor('#4f46e5');
      setAiForm({
        topic: '',
        pdf_file: null,
        tone: 'Profesional',
        format: 'reel'
      });
      setLastGeneratedBlogContent(null);
      setPrelisteningTrack(null);
      transformer.loadState({});
      showToast('Nuevo proyecto iniciado', 'success');
    }
  };

  const handleStartFromScratch = () => {
    setActiveMode('scratch');
    setSelectedPost(null);
    setActiveProjectName(null);
    setActiveProjectId(null);
    setHistory([]);
    setVideoStyles(DEFAULT_VIDEO_STYLES);
    setSlideDuration(3);
    setTransitionType('fade');
    setTransitionDuration(0.5);
    designer.canvas.setExtraElements({});
    designer.canvas.setCurrentSlidePage(0);
    designer.design.setTitleColor('#000000');
    designer.design.setContentColor('#000000');
    designer.design.setHeaderColor('#4f46e5');
    setAiForm({
      topic: '',
      pdf_file: null,
      tone: 'Profesional',
      format: 'reel'
    });
    setLastGeneratedBlogContent(null);
    setSelectedAudio(null);
    setCustomAudioUrl(null);
    setPrelisteningTrack(null);
    transformer.loadState({});
    
    setGeneratedContent({
      type: 'carousel',
      slides: [{ title: 'Nueva Diapositiva', content: 'Doble clic para editar' }],
      video_slides: [{ title: 'Nueva Diapositiva', content: 'Doble clic para editar' }]
    });
  };

  const handleSaveProject = async () => {
    if (!activeProjectId || !activeProjectName) {
      return handleSaveProjectAs();
    }

    setSavingType('save');
    startSaveProgress();
    try {
      const videoSettings = { videoStyles, slideDuration };
      const contentToSave = { ...generatedContent, videoSettings, transformerState: transformer.state, showBgImage };
      const savedResult = await designer.canvas.saveProject(activeProjectName, contentToSave, activeProjectId);
      
      if (savedResult) {
        stopSaveProgress(true);
        showToast(`"${activeProjectName}" actualizado con éxito`, 'success');
      } else {
        stopSaveProgress(false);
        showToast('No se pudo actualizar el proyecto', 'error');
      }
    } catch (error) {
      console.error('[Arko360] Error updating project:', error);
      stopSaveProgress(false);
      showToast('Error crítico al actualizar el proyecto', 'error');
    }
  };

  const handleSaveProjectAs = () => {
    setSaveAsProjectName(activeProjectName || selectedPost?.title || 'Mi Carrusel');
    setIsSaveAsModalOpen(true);
  };

  const handleSaveProjectAsConfirm = async () => {
    const name = saveAsProjectName.trim();
    if (!name) return;
    
    // Validate uniqueness
    const nameExists = designer.canvas.projects?.some(p => p.name?.toLowerCase() === name.toLowerCase());
    if (nameExists) {
      showToast(`Ya existe un proyecto llamado "${name}". Elige otro nombre.`, 'error');
      return;
    }
    
    setIsSaveAsModalOpen(false);
    setSavingType('saveAs');
    startSaveProgress();
    try {
      const videoSettings = { videoStyles, slideDuration };
      const contentToSave = { ...generatedContent, videoSettings, transformerState: transformer.state, showBgImage };
      const savedResult = await designer.canvas.saveProject(name, contentToSave, null);
      
      if (savedResult) {
        const newId = (typeof savedResult === 'object' && savedResult.id) ? savedResult.id : (designer.canvas.projects?.find(p => p.name === name)?.id || null);
        setActiveProjectName(name);
        if (newId) setActiveProjectId(newId);
        stopSaveProgress(true);
        showToast(`Nuevo proyecto "${name}" creado con éxito`, 'success');
      } else {
        stopSaveProgress(false);
        showToast('No se pudo crear el nuevo proyecto', 'error');
      }
    } catch (error) {
      console.error('[Arko360] Error creating new project:', error);
      stopSaveProgress(false);
      showToast('Error crítico al crear el nuevo proyecto', 'error');
    }
  };

  const handleRemoveSlide = (index) => {
    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
    const arr = generatedContent[slidesProp];
    if (arr.length <= 1) return;
    const newSlides = arr.filter((_, i) => i !== index);
    setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
    
    // Shift extraElements
    const currentExtra = designer.canvas.extraElements;
    const newExtra = {};
    Object.keys(currentExtra).forEach(key => {
      const i = parseInt(key);
      if (i < index) {
        newExtra[i] = currentExtra[i];
      } else if (i > index) {
        newExtra[i - 1] = currentExtra[i];
      }
    });
    designer.canvas.setExtraElements(newExtra);
    
    // Shift transformer state (images and content positions)
    const tState = transformer.state;
    const newTState = {
      imagePositions: {}, imageSizes: {}, imageRotations: {},
      contentPositions: {}, contentSizes: {}, contentRotations: {}
    };
    
    ['imagePositions', 'imageSizes', 'imageRotations'].forEach(prop => {
      Object.keys(tState[prop]).forEach(key => {
        const [sIdxStr, imgIdx] = key.split('-');
        const sIdx = parseInt(sIdxStr);
        if (sIdx < index) {
          newTState[prop][key] = tState[prop][key];
        } else if (sIdx > index) {
          newTState[prop][`${sIdx - 1}-${imgIdx}`] = tState[prop][key];
        }
      });
    });
    
    ['contentPositions', 'contentSizes', 'contentRotations'].forEach(prop => {
      Object.keys(tState[prop] || {}).forEach(key => {
        const sIdx = parseInt(key);
        if (sIdx < index) {
          newTState[prop][sIdx] = tState[prop][sIdx];
        } else if (sIdx > index) {
          newTState[prop][sIdx - 1] = tState[prop][sIdx];
        }
      });
    });
    
    transformer.loadState(newTState);
    
    designer.canvas.setCurrentSlidePage(Math.max(0, designer.canvas.currentSlidePage - 1));
  };

  const handleCopySlide = (index) => {
    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
    const arr = generatedContent[slidesProp];
    const newSlides = [...arr];
    const slideToCopy = JSON.parse(JSON.stringify(arr[index])); // deep copy
    newSlides.splice(index + 1, 0, slideToCopy);
    setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
    
    // Shift and copy extraElements
    const currentExtra = designer.canvas.extraElements;
    const newExtra = {};
    Object.keys(currentExtra).forEach(key => {
      const i = parseInt(key);
      if (i <= index) {
        newExtra[i] = currentExtra[i];
      } else if (i > index) {
        newExtra[i + 1] = currentExtra[i];
      }
    });
    
    // Copy the elements for the duplicated slide with new IDs
    if (currentExtra[index]) {
      newExtra[index + 1] = currentExtra[index].map(el => ({
        ...el,
        id: Math.random().toString(36).substr(2, 9)
      }));
    }
    designer.canvas.setExtraElements(newExtra);
    
    // Shift and copy transformer state (images and content positions)
    const tState = transformer.state;
    const newTState = {
      imagePositions: {}, imageSizes: {}, imageRotations: {},
      contentPositions: {}, contentSizes: {}, contentRotations: {}
    };
    
    ['imagePositions', 'imageSizes', 'imageRotations'].forEach(prop => {
      Object.keys(tState[prop]).forEach(key => {
        const [sIdxStr, imgIdx] = key.split('-');
        const sIdx = parseInt(sIdxStr);
        if (sIdx <= index) {
          newTState[prop][key] = tState[prop][key];
          if (sIdx === index) {
            // copy to the duplicated slide
            newTState[prop][`${index + 1}-${imgIdx}`] = tState[prop][key];
          }
        } else if (sIdx > index) {
          newTState[prop][`${sIdx + 1}-${imgIdx}`] = tState[prop][key];
        }
      });
    });
    
    ['contentPositions', 'contentSizes', 'contentRotations'].forEach(prop => {
      Object.keys(tState[prop] || {}).forEach(key => {
        const sIdx = parseInt(key);
        if (sIdx <= index) {
          newTState[prop][sIdx] = tState[prop][sIdx];
          if (sIdx === index) {
            // copy to the duplicated slide
            newTState[prop][index + 1] = tState[prop][sIdx];
          }
        } else if (sIdx > index) {
          newTState[prop][sIdx + 1] = tState[prop][sIdx];
        }
      });
    });
    
    transformer.loadState(newTState);
    
    designer.canvas.setCurrentSlidePage(index + 1);
  };

  const handleClearMainContent = (index) => {
    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
    const arr = generatedContent[slidesProp];
    const newSlides = [...arr];
    newSlides[index].title = '';
    newSlides[index].content = '';
    newSlides[index].text = '';
    setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
  };

  const handleDuplicateMainContent = (index) => {
    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
    const arr = generatedContent[slidesProp];
    const slide = arr[index];
    const combinedText = [slide?.title, slide?.content || slide?.text].filter(Boolean).join('<br/>');
    if (combinedText) {
      designer.canvas.addExtraElement(index, 'text', combinedText, designer.design.fontFamily);
      showToast('Texto duplicado correctamente', 'success');
    }
  };

  // Auto-guarda al borrar un elemento para que no vuelva a aparecer al reabrir el archivo
  const handleRemoveElement = async (slideIndex, elementId) => {
    // 1. Calcular el nuevo estado ANTES del borrado (React state aún no actualizó)
    const currentElements = designer.canvas.extraElements;
    const updatedElements = {};
    Object.keys(currentElements).forEach(key => {
      updatedElements[key] = currentElements[key];
    });
    const slideElements = (updatedElements[slideIndex] || []).filter(el => el.id !== elementId);
    updatedElements[slideIndex] = slideElements;

    // 2. Borrar del estado en memoria inmediatamente
    designer.canvas.removeExtraElement(slideIndex, elementId);

    // 3. Si hay un proyecto guardado activo, persistir el cambio en el servidor en segundo plano
    if (activeProjectId && activeProjectName) {
      try {
        const videoSettings = { videoStyles, slideDuration };
        const contentToSave = { ...generatedContent, videoSettings, transformerState: transformer.state };
        const projectData = {
          name: activeProjectName,
          id: activeProjectId,
          content: contentToSave,
          design: {
            bgColor: designer.design.bgColor, bgColor2: designer.design.bgColor2, bgColor3: designer.design.bgColor3,
            useBgGradient: designer.design.useBgGradient, fontSize: designer.design.fontSize,
            titleFontSize: designer.design.titleFontSize, headerFontSize: designer.design.headerFontSize,
            titleColor: designer.design.titleColor, contentColor: designer.design.contentColor,
            headerColor: designer.design.headerColor, imageBorderRadius: designer.design.imageBorderRadius
          },
          global_settings: {
            logoPos: designer.design.logoPos, doctorNamePos: designer.design.doctorNamePos,
            dividerPos: designer.design.dividerPos, dividerColor: designer.design.dividerColor,
            dividerHeight: designer.design.dividerHeight, dividerWidth: designer.design.dividerWidth
          },
          elements: updatedElements
        };
        await blogService.updateCarouselProject(activeProjectId, projectData);
      } catch (err) {
        console.error('[Arko360] Auto-save after delete failed:', err);
      }
    }
  };

  const handleAddImage = async (index, e) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      try {
        const response = await blogService.uploadSocialMedia(file);
        if (response && response.url) {
          pushToHistory(generatedContent);
          const newSlides = [...generatedContent.slides];
          if (!newSlides[index].customImages) newSlides[index].customImages = [];
          // Asegurarse de agregar el origen para que sea una URL absoluta si es necesario, 
          // o getImageUrl lo manejará si se usa en la renderización.
          newSlides[index].customImages.push(response.url);
          setGeneratedContent({ ...generatedContent, slides: newSlides });
        }
      } catch (error) {
        showToast('Error al subir imagen', 'error');
      }
      if (e.target) e.target.value = null;
    }
  };

  const handleRemoveImage = (slideIndex, imgIndex) => {
    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
    const newSlides = [...generatedContent[slidesProp]];
    if (newSlides[slideIndex]?.customImages) {
      const oldImgCount = newSlides[slideIndex].customImages.length;
      newSlides[slideIndex].customImages = newSlides[slideIndex].customImages.filter((_, i) => i !== imgIndex);
      setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
      
      // Shift ALL image states down for the remaining images
      const shiftState = (setter) => {
        if (setter) {
          setter(prev => {
            const next = { ...prev };
            delete next[`${slideIndex}-${imgIndex}`];
            for (let i = imgIndex + 1; i < oldImgCount; i++) {
              if (next[`${slideIndex}-${i}`] !== undefined) {
                next[`${slideIndex}-${i - 1}`] = next[`${slideIndex}-${i}`];
                delete next[`${slideIndex}-${i}`];
              }
            }
            return next;
          });
        }
      };

      shiftState(transformer?.state?.setImagePositions);
      shiftState(transformer?.state?.setImageSizes);
      shiftState(transformer?.state?.setImageRotations);

      if (designer.canvas.setSelectedImageId) {
        designer.canvas.setSelectedImageId(null);
      }
    }
  };

  const handleOpenCropImage = (slideIdx, imgIdx) => {
    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
    const img = generatedContent?.[slidesProp]?.[slideIdx]?.customImages?.[imgIdx];
    if (img) {
      setCropModalData({ isOpen: true, slideIdx, imgIdx, imageUrl: img });
    }
  };

  const handleCropComplete = (croppedImageBase64) => {
    const { slideIdx, imgIdx } = cropModalData;
    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
    const newSlides = [...generatedContent[slidesProp]];
    if (newSlides[slideIdx]?.customImages) {
      newSlides[slideIdx].customImages[imgIdx] = croppedImageBase64;
      setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
      
      // Update transformer dimensions
      const imgId = `${slideIdx}-${imgIdx}`;
      if (transformer.state.imagePositions?.[imgId]) {
        // Just let it re-render, no need to manually touch positions unless size aspect ratio changed drastically
      }
    }
    designer.canvas.selectElement(null, null);
  };

  const handleAddImageToVideoSlide = async (index, e) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      try {
        const response = await blogService.uploadSocialMedia(file);
        if (response && response.url) {
          const newSlides = [...generatedContent.video_slides];
          if (!newSlides[index].customImages) newSlides[index].customImages = [];
          
          const isVideo = file.type.startsWith('video/');
          if (isVideo) {
            const slide = newSlides[index];
            let maxVidDur = 0;
            const tEnd = slide?.titleEndTime !== undefined ? slide.titleEndTime : slideDuration;
            if (tEnd > maxVidDur) maxVidDur = tEnd;
            const cEnd = slide?.contentEndTime !== undefined ? slide.contentEndTime : slideDuration;
            if (cEnd > maxVidDur) maxVidDur = cEnd;
            const extraEls = designer.canvas.extraElements[index] || [];
            extraEls.forEach(el => {
              const eEnd = el.endTime !== undefined ? el.endTime : slideDuration;
              if (eEnd > maxVidDur) maxVidDur = eEnd;
            });
            if (slide?.customImages) {
              slide.customImages.forEach((img, i) => {
                const imgId = `${index}-${i}`;
                const pos = transformer.state?.imagePositions?.[imgId] || {};
                const endT = pos.endTime !== undefined ? pos.endTime : slideDuration;
                if (endT > maxVidDur) maxVidDur = endT;
              });
            }
            
            const newImgIdx = newSlides[index].customImages.length;
            if (transformer.state.setImagePositions) {
              transformer.state.setImagePositions(prev => ({
                ...prev,
                [`${index}-${newImgIdx}`]: {
                  x: 50, y: 70, scale: 1, rot: 0, opacity: 1,
                  startTime: maxVidDur
                }
              }));
            }
          }

          newSlides[index].customImages.push(response.url);
          setGeneratedContent({ ...generatedContent, video_slides: newSlides });
        }
      } catch (error) {
        showToast('Error al subir video/imagen', 'error');
      }
      if (e.target) e.target.value = null;
    }
  };

  const handleEditVideo = (slideIndex, imgIndex, dataUrl) => {
    const imgId = `${slideIndex}-${imgIndex}`;
    const pos = transformer?.state?.imagePositions?.[imgId] || {};
    
    const targetBase = { 
      index: slideIndex, 
      isVideoSlide: activeTab === 'video', 
      imgIndex: imgIndex,
      initialState: {
        trimStart: pos.trimStart || 0,
        trimEnd: pos.trimEnd,
        speed: pos.speed || 1,
        isMuted: pos.isMuted || false
      }
    };

    if (dataUrl.startsWith('data:')) {
      // Legacy base64 support (for older projects already saved)
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const file = new File([u8arr], 'video.mp4', { type: mime });
      setPendingVideoTarget(targetBase);
      setPendingVideoFile(file);
    } else {
      // It's an uploaded URL — set everything atomically in one call
      setPendingVideoFile(null);
      setPendingVideoTarget({ ...targetBase, url: dataUrl });
    }
  };



  if (isMobile) {
    return (
      <MobileLayout 
        posts={posts} selectedPost={selectedPost} setSelectedPost={setSelectedPost}
        generating={generating} generatedContent={generatedContent} setGeneratedContent={setGeneratedContent}
        handleGenerate={handleGenerate} handleTestDesign={() => { setActiveTab('carousel'); setGeneratedContent({ type: 'carousel', slides: [{ title: 'Prueba', content: 'Contenido' }] }); }}
        showProjects={showProjects} setShowProjects={setShowProjects}
        designer={designer} handleLoadProject={handleLoadProject}
        activeProjectName={activeProjectName} isMobileFullscreen={isMobileFullscreen}
        loadingProjects={designer.canvas.loadingProjects}
        exitMobileFullscreen={exitMobileFullscreen} scale={scale} doctor={doctor}
        doctorLogoBase64={doctorLogoBase64} transformer={transformer} watermarkImage={watermarkImage}
        handleRemoveSlide={handleRemoveSlide} handleAddImage={handleAddImage}
        handleRemoveImage={handleRemoveImage} setEditingIndex={setEditingIndex}
        setPreviewIndex={setPreviewIndex} showToast={showToast}
        handleConvertToVideo={handleConvertToVideo} handleSaveProject={handleSaveProject}
        handleSaveProjectAs={handleSaveProjectAs} handleSaveTemplate={() => {}}
        activeProjectId={activeProjectId} exporter={exporter}
        activeTab={activeTab} setActiveTab={setActiveTab}
        videoStyles={videoStyles} setVideoStyles={setVideoStyles}
        slideDuration={slideDuration} setSlideDuration={setSlideDuration}
        isPlaying={isPlaying} setIsPlaying={setIsPlaying}
        currentVideoSlide={currentVideoSlide} setCurrentVideoSlide={setCurrentVideoSlide}
        selectedAudio={selectedAudio} setSelectedAudio={setSelectedAudio}
        globalAudio={globalAudio} setGlobalAudio={setGlobalAudio}
        audioApplyMode={audioApplyMode} setAudioApplyMode={setAudioApplyMode}
        userAudios={userAudios} loadingAudios={loadingAudios}
        handleUploadAudio={handleUploadAudio} handleDeleteAudio={handleDeleteAudio}
        prelisteningTrack={prelisteningTrack} setPrelisteningTrack={setPrelisteningTrack}
        customAudioUrl={customAudioUrl} setCustomAudioUrl={setCustomAudioUrl}
        audioRef={audioRef} globalAudioRef={globalAudioRef} previewAudioRef={previewAudioRef}
        isExporting={isExporting} exportProgress={exportProgress}
        handleExportVideo={handleExportVideo} handleAddImageToVideoSlide={handleAddImageToVideoSlide}
        enterMobileFullscreen={enterMobileFullscreen}
        exportStatus={exportStatus}
        savingType={savingType} saveProgress={saveProgress}
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        aiForm={aiForm}
        setAiForm={setAiForm}
        handleAiGenerateSocial={handleAiGenerateSocial}
      />
    );
  }

  let currentMaxVidDur = 0;
  if (activeTab === 'video' && generatedContent?.video_slides) {
    const slide = generatedContent.video_slides[designer.canvas.currentSlidePage];
    if (slide) {
      currentMaxVidDur = slideDuration;
      const tEnd = slide.titleEndTime !== undefined ? slide.titleEndTime : slideDuration;
      if (tEnd > currentMaxVidDur) currentMaxVidDur = tEnd;
      const cEnd = slide.contentEndTime !== undefined ? slide.contentEndTime : slideDuration;
      if (cEnd > currentMaxVidDur) currentMaxVidDur = cEnd;
      
      const extraEls = designer.canvas.extraElements[designer.canvas.currentSlidePage] || [];
      extraEls.forEach(el => {
        const eEnd = el.endTime !== undefined ? el.endTime : slideDuration;
        if (eEnd > currentMaxVidDur) currentMaxVidDur = eEnd;
      });
      
      if (slide.customImages) {
        slide.customImages.forEach((img, imgIdx) => {
          const imgId = `${designer.canvas.currentSlidePage}-${imgIdx}`;
          const pos = transformer?.state?.imagePositions?.[imgId] || {};
          const endT = pos.endTime !== undefined ? pos.endTime : slideDuration;
          if (endT > currentMaxVidDur) currentMaxVidDur = endT;
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 font-manrope">
      <div className="max-w-[1480px] mx-auto px-4 pt-6">
        <header className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <FiCpu className="text-indigo-600" /> Editor Arko360
          </h1>
        </header>

        <div className="space-y-8">
          <ArticleSelector 
            posts={posts} selectedPost={selectedPost} setSelectedPost={setSelectedPost}
            setGeneratedContent={setGeneratedContent} showProjects={showProjects}
            setShowProjects={setShowProjects} handleGenerate={handleGenerate}
            handleTestDesign={designer.handleTestDesign}
            generating={generating}
            projects={designer.canvas.projects}
            loadingProjects={designer.canvas.loadingProjects}
            onLoadProject={(p) => { handleLoadProject(p); setShowProjects(false); }}
            onDeleteProject={designer.canvas.deleteProject}
            activeProjectId={activeProjectId}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            aiForm={aiForm}
            setAiForm={setAiForm}
            handleAiGenerateSocial={handleAiGenerateSocial}
            primaryColor={doctor?.theme_primary_color || '#4F46E5'}
            generatedContent={generatedContent}
            handleStartFromScratch={handleStartFromScratch}
          />

          {/* RESTAURACIÓN DEL LAYOUT ORIGINAL DE TABS */}
          {generatedContent && (
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 animate-fadeIn">
              {/* Left: Tab switcher */}
              <div className="flex bg-gray-50 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700">
                <button 
                  onClick={() => {
                    if (activeTab !== 'video') {
                      setActiveTab('video');
                      localStorage.setItem('socialGenTab', 'video');
                      setGeneratedContent(null);
                      setActiveProjectId(null);
                      setActiveProjectName(null);
                      setSelectedPost(null);
                      designer.canvas.setCurrentSlidePage(0);
                    }
                  }} 
                  className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'video' || activeTab === 'reel' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Editor de Video
                </button>
                <button 
                  onClick={() => {
                    if (activeTab !== 'carousel') {
                      setActiveTab('carousel');
                      localStorage.setItem('socialGenTab', 'carousel');
                      setGeneratedContent(null);
                      setActiveProjectId(null);
                      setActiveProjectName(null);
                      setSelectedPost(null);
                      designer.canvas.setCurrentSlidePage(0);
                    }
                  }} 
                  className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'carousel' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Editor de Carrusel
                </button>
              </div>

              {/* Center: Active project name */}
              {activeProjectName && (
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800 max-w-xs">
                  <FiFolder className="text-indigo-500 flex-shrink-0" size={14} />
                  <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-tight truncate">{activeProjectName}</span>
                </div>
              )}

              {/* Right: Save buttons */}
              <div className="flex gap-3">
                <button 
                  onClick={handleNewProject} 
                  className="px-5 py-3 text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95 flex items-center gap-2"
                  title="Nuevo Proyecto"
                >
                  <FiFilePlus size={16} />
                  <span className="hidden sm:inline">Nuevo</span>
                </button>
                <button 
                  onClick={handleSaveProject} 
                  disabled={savingType !== null}
                  style={{ backgroundColor: 'rgb(205, 8, 87)' }}
                  className="relative px-8 py-3 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-pink-200 hover:opacity-90 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-80 overflow-hidden"
                >
                  {/* Animated progress bar underlay */}
                  {savingType === 'save' && (
                    <span 
                      className="absolute inset-0 bg-white/20 transition-all duration-300 origin-left"
                      style={{ transform: `scaleX(${saveProgress / 100})` }}
                    />
                  )}
                  {/* Circular spinner */}
                  {savingType === 'save' ? (
                    <>
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 36 36">
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
                  className="relative px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-80 overflow-hidden"
                >
                  {/* Animated progress bar underlay */}
                  {savingType === 'saveAs' && (
                    <span 
                      className="absolute inset-0 bg-gray-200 dark:bg-gray-600 transition-all duration-300 origin-left"
                      style={{ transform: `scaleX(${saveProgress / 100})` }}
                    />
                  )}
                  {/* Circular spinner */}
                  {savingType === 'saveAs' ? (
                    <>
                      <svg className="w-4 h-4 flex-shrink-0 text-gray-400" viewBox="0 0 36 36">
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

          {generating && (
            <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-gray-800 rounded-[40px] shadow-sm border border-gray-100 dark:border-gray-700">
              <ArkoLoader fullScreen={false} text="Cargando..." />
            </div>
          )}

          {generatedContent && !generating && (
            <div className="animate-fadeIn">

                <div className="flex gap-6">
                  <EnhancedSidebar 
                    design={designer.design} canvas={designer.canvas} 
                    transform={transformer.state} currentSlide={designer.canvas.currentSlidePage}
                    onAddElement={designer.canvas.addExtraElement} 
                    onRemoveImage={handleRemoveImage}
                    onDownload={activeTab === 'video' ? handleExportVideo : exporter.downloadCarousel}
                    onSave={handleSaveProject} onConvertToVideo={handleConvertToVideo}
                    isVideoMode={activeTab === 'video'}
                    selectedAudio={selectedAudio} setSelectedAudio={setSelectedAudio}
                    globalAudio={globalAudio} setGlobalAudio={setGlobalAudio}
                    audioApplyMode={audioApplyMode} setAudioApplyMode={setAudioApplyMode}
                    handleUploadAudio={handleUploadAudio}
                    slideDuration={slideDuration} setSlideDuration={setSlideDuration}
                    userAudios={userAudios}
                    loadingAudios={loadingAudios}
                    handleDeleteAudio={handleDeleteAudio}
                    isExporting={isExporting}
                    exportProgress={exportProgress}
                  />
                  <div className="flex-1 space-y-6 flex flex-col items-center justify-start pt-10">
                    <div ref={editorWrapperRef} className={`bg-white dark:bg-gray-800 rounded-[40px] ${activeTab === 'video' ? 'p-4 pr-16 overflow-visible' : 'p-12 pr-16 max-w-full min-h-[600px] w-full overflow-visible'} shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center relative`}>
                      
                      {/* Fondo Perfil ON/OFF Selector */}
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                        <button
                          onClick={() => setShowBgImage(!showBgImage)}
                          className={`px-3.5 py-1.5 rounded-full transition-all text-xs font-black flex items-center gap-2 shadow-md cursor-pointer border ${
                            showBgImage 
                              ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700' 
                              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                          }`}
                          title="Prender / Apagar Imagen de Fondo de Perfil"
                        >
                          <FiImage size={14} />
                          <span>Fondo Perfil: {showBgImage ? 'ON' : 'OFF'}</span>
                        </button>
                      </div>

                      <div style={{ width: 410 * scale, height: (activeTab === 'video' ? 728 : 410) * scale }} className="relative flex items-center justify-center transition-all duration-300">
                        <div id="main-slide-canvas" className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
                          <SlideCanvas 
                            slide={activeTab === 'video' ? generatedContent.video_slides?.[designer.canvas.currentSlidePage] : generatedContent.slides?.[designer.canvas.currentSlidePage]}
                            index={designer.canvas.currentSlidePage}
                            doctor={doctor} doctorLogo={doctorLogoBase64}
                            siteConfig={siteConfig}
                            design={designer.design} canvas={designer.canvas}
                            transform={transformer.state} handlers={transformer.handlers}
                            watermark={watermarkImage} onEdit={setEditingIndex}
                            onPreview={setPreviewIndex} onRemove={handleRemoveSlide} onCopy={handleCopySlide}
                            onClearMainContent={handleClearMainContent}
                            onDuplicateMainContent={handleDuplicateMainContent}
                            onAddImage={(e) => activeTab === 'video' ? handleAddImageToVideoSlide(designer.canvas.currentSlidePage, e) : handleAddImage(designer.canvas.currentSlidePage, e)}
                            onRemoveImage={handleRemoveImage}
                            onCropImage={handleOpenCropImage}
                            isVideoMode={activeTab === 'video'}
                            showGrid={showGrid}
                            showBgImage={showBgImage}
                            currentTime={videoTime}
                            isPlaying={isPlaying}
                            onEditVideo={handleEditVideo}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center gap-2 animate-fadeIn mt-4">
                      {/* Combined Pagination, Playback & Volume Pill */}
                      <div className="flex flex-wrap items-center justify-center gap-4 bg-white/95 dark:bg-gray-800/90 backdrop-blur-md rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-1.5">
                        <button 
                          onClick={() => designer.canvas.setCurrentSlidePage(Math.max(0, designer.canvas.currentSlidePage - 1))}
                          disabled={designer.canvas.currentSlidePage === 0}
                          className={`p-1.5 rounded-full transition-all ${designer.canvas.currentSlidePage === 0 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 active:scale-95'}`}
                        >
                          <FiChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-black text-gray-700 dark:text-gray-300 min-w-[32px] text-center select-none uppercase tracking-wider">
                          {designer.canvas.currentSlidePage + 1} / {activeTab === 'video' ? (generatedContent.video_slides?.length || 0) : (generatedContent.slides?.length || 0)}
                        </span>
                        <button 
                          onClick={() => designer.canvas.setCurrentSlidePage(Math.min((activeTab === 'video' ? generatedContent.video_slides?.length : generatedContent.slides?.length) - 1, designer.canvas.currentSlidePage + 1))}
                          disabled={designer.canvas.currentSlidePage === (activeTab === 'video' ? generatedContent.video_slides?.length : generatedContent.slides?.length) - 1}
                          className={`p-1.5 rounded-full transition-all ${designer.canvas.currentSlidePage === (activeTab === 'video' ? generatedContent.video_slides?.length : generatedContent.slides?.length) - 1 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 active:scale-95'}`}
                        >
                          <FiChevronRight size={16} />
                        </button>

                        <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>

                        <button 
                          onClick={() => setShowGrid(!showGrid)}
                          className={`p-1.5 rounded-full transition-all ${showGrid ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20'}`}
                          title="Mostrar Cuadrícula Guía"
                        >
                          <FiGrid size={16} />
                        </button>

                        {siteConfig?.socialBackgroundImage && (
                          <button 
                            onClick={() => setShowBgImage(!showBgImage)}
                            className={`p-1.5 rounded-full transition-all ${showBgImage ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20'}`}
                            title="Prender / Apagar Imagen de Fondo de Perfil"
                          >
                            <FiImage size={16} />
                          </button>
                        )}

                        {activeTab === 'video' && (
                          <>
                            <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                            <button
                              onClick={() => {
                                setIsPlaying(false);
                                designer.canvas.setCurrentSlidePage(0);
                                setCurrentVideoSlide(0);
                              }}
                              className="p-1.5 rounded-full transition-all text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 active:scale-95"
                              title="Detener y volver al inicio"
                            >
                              <div className="w-3 h-3 bg-current rounded-sm"></div>
                            </button>
                            <button
                              onClick={() => {
                                if (!isPlaying && videoTime >= currentMaxVidDur) {
                                  setVideoTime(0);
                                }
                                setIsPlaying(!isPlaying);
                              }}
                              className={`p-2 rounded-full transition-all ${isPlaying ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'} shadow-md transform hover:scale-105 active:scale-95`}
                              title={isPlaying ? "Pausar" : "Reproducir"}
                            >
                              {isPlaying ? <FiPause size={16} /> : <FiPlay size={16} />}
                            </button>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 min-w-[70px] text-center tracking-wider">
                              {videoTime.toFixed(1)}s <span className="text-gray-400 font-medium">/ {currentMaxVidDur.toFixed(1)}s</span>
                            </span>
                            <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Volumen:</span>
                              <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05"
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                title={`Volumen: ${Math.round(volume * 100)}%`}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {activeTab === 'video' && (() => {
                      const slide = generatedContent.video_slides?.[designer.canvas.currentSlidePage];
                      
                      let maxVidDur = 0;
                      
                      // 1. Title and Content
                      const tEnd = slide?.titleEndTime !== undefined ? slide.titleEndTime : slideDuration;
                      if (tEnd > maxVidDur) maxVidDur = tEnd;
                      
                      const cEnd = slide?.contentEndTime !== undefined ? slide.contentEndTime : slideDuration;
                      if (cEnd > maxVidDur) maxVidDur = cEnd;

                      // 2. Extra Elements
                      const extraEls = designer.canvas.extraElements[designer.canvas.currentSlidePage] || [];
                      extraEls.forEach(el => {
                        const eEnd = el.endTime !== undefined ? el.endTime : slideDuration;
                        if (eEnd > maxVidDur) maxVidDur = eEnd;
                      });
                      
                      // 3. Videos and Images
                      if (slide?.customImages) {
                        slide.customImages.forEach((img, imgIdx) => {
                          const imgId = `${designer.canvas.currentSlidePage}-${imgIdx}`;
                          const pos = transformer.state?.imagePositions?.[imgId] || {};
                          const endT = pos.endTime !== undefined ? pos.endTime : slideDuration;
                          if (endT > maxVidDur) maxVidDur = endT;
                        });
                      }
                      
                      // Asegurar un mínimo de 1 segundo
                      const totalVideoDuration = (generatedContent?.video_slides || []).reduce((acc, s) => {
                        return acc + (s.duration || slideDuration);
                      }, 0);

                      return (
                        <div className="w-full mt-4">
                          <TimelinePanel 
                            slide={slide}
                            slideIndex={designer.canvas.currentSlidePage}
                            slideDuration={maxVidDur}
                            totalVideoDuration={totalVideoDuration}
                            currentTime={videoTime}
                            onUpdateTiming={handleUpdateTiming}
                            onScrub={setVideoTime}
                            extraElements={designer.canvas.extraElements[designer.canvas.currentSlidePage] || []}
                            imagePositions={transformer.state.imagePositions || {}}
                            globalAudio={globalAudio}
                            onDeleteTrack={(trackId) => {
                              if (trackId === 'globalAudio') {
                                // Actualización atómica: un solo setGeneratedContent
                                setGeneratedContent(prev => ({
                                  ...prev,
                                  videoSettings: {
                                    ...(prev?.videoSettings || {}),
                                    globalAudio: null,
                                    globalCustomAudioUrl: null,
                                  }
                                }));
                              }
                              if (trackId === 'audio') {
                                // Actualización atómica: un solo setGeneratedContent
                                setGeneratedContent(prev => {
                                  if (!prev?.video_slides) return prev;
                                  const targetIdx = activeSlideIdx < prev.video_slides.length ? activeSlideIdx : 0;
                                  const newSlides = [...prev.video_slides];
                                  newSlides[targetIdx] = {
                                    ...newSlides[targetIdx],
                                    audio: null,
                                    customAudioUrl: null,
                                  };
                                  return { ...prev, video_slides: newSlides };
                                });
                              }
                            }}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>



      <ImageCropperModal
        isOpen={cropModalData.isOpen}
        onClose={() => setCropModalData({ isOpen: false, slideIdx: null, imgIdx: null, imageUrl: null })}
        imageUrl={cropModalData.imageUrl}
        onCropComplete={handleCropComplete}
      />

      {/* Edit Content Modal */}
      {editingIndex !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Editar Diapositiva {editingIndex + 1}</h3>
              <button onClick={() => setEditingIndex(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <FiX size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Título</label>
                <input 
                  type="text"
                  value={activeTab === 'video' ? (generatedContent.video_slides[editingIndex]?.title || '') : (generatedContent.slides[editingIndex]?.title || '')}
                  onChange={(e) => {
                    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
                    const newSlides = [...generatedContent[slidesProp]];
                    if (newSlides[editingIndex]) {
                      newSlides[editingIndex].title = e.target.value;
                      setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
                    }
                  }}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Contenido</label>
                
                {/* Formato Toolbar */}
                <div className="flex items-center gap-1 mb-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl self-start">
                  <button onClick={() => {
                    const textarea = document.getElementById('slide-content-editor');
                    if (!textarea) return;
                    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
                    const newSlides = [...generatedContent[slidesProp]];
                    const slide = newSlides[editingIndex];
                    let text = slide.content || slide.text || '';
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const selected = text.substring(start, end);
                    const newText = text.substring(0, start) + '**' + (selected || 'negrita') + '**' + text.substring(end);
                    slide.content = newText;
                    setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
                    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + 2, start + 2 + (selected ? selected.length : 7)); }, 0);
                  }} className="p-1.5 text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-indigo-600 rounded-lg transition-all" title="Negrita (**)"><FiBold size={14}/></button>
                  <button onClick={() => {
                    const textarea = document.getElementById('slide-content-editor');
                    if (!textarea) return;
                    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
                    const newSlides = [...generatedContent[slidesProp]];
                    const slide = newSlides[editingIndex];
                    let text = slide.content || slide.text || '';
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const selected = text.substring(start, end);
                    const newText = text.substring(0, start) + '_' + (selected || 'cursiva') + '_' + text.substring(end);
                    slide.content = newText;
                    setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
                    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + 1, start + 1 + (selected ? selected.length : 7)); }, 0);
                  }} className="p-1.5 text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-indigo-600 rounded-lg transition-all" title="Cursiva (_)"><FiItalic size={14}/></button>
                  <button onClick={() => {
                    const textarea = document.getElementById('slide-content-editor');
                    if (!textarea) return;
                    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
                    const newSlides = [...generatedContent[slidesProp]];
                    const slide = newSlides[editingIndex];
                    let text = slide.content || slide.text || '';
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const selected = text.substring(start, end);
                    const prefix = start === 0 || text[start - 1] === '\n' ? '• ' : '\n• ';
                    const newText = text.substring(0, start) + prefix + selected + text.substring(end);
                    slide.content = newText;
                    setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
                    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); }, 0);
                  }} className="p-1.5 text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-indigo-600 rounded-lg transition-all" title="Viñeta"><FiList size={14}/></button>
                  
                  <div className="w-[1px] h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                  
                  <button onClick={() => {
                    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
                    const newSlides = [...generatedContent[slidesProp]];
                    newSlides[editingIndex].textAlign = 'left';
                    setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
                  }} className={`p-1.5 rounded-lg transition-all ${((activeTab === 'video' ? generatedContent?.video_slides[editingIndex]?.textAlign : generatedContent?.slides[editingIndex]?.textAlign) === 'left') ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700'}`} title="Alinear Izquierda"><FiAlignLeft size={14}/></button>
                  <button onClick={() => {
                    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
                    const newSlides = [...generatedContent[slidesProp]];
                    newSlides[editingIndex].textAlign = 'center';
                    setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
                  }} className={`p-1.5 rounded-lg transition-all ${((activeTab === 'video' ? generatedContent?.video_slides[editingIndex]?.textAlign : generatedContent?.slides[editingIndex]?.textAlign) !== 'left' && (activeTab === 'video' ? generatedContent?.video_slides[editingIndex]?.textAlign : generatedContent?.slides[editingIndex]?.textAlign) !== 'right') ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700'}`} title="Centrar"><FiAlignCenter size={14}/></button>
                  <button onClick={() => {
                    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
                    const newSlides = [...generatedContent[slidesProp]];
                    newSlides[editingIndex].textAlign = 'right';
                    setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
                  }} className={`p-1.5 rounded-lg transition-all ${((activeTab === 'video' ? generatedContent?.video_slides[editingIndex]?.textAlign : generatedContent?.slides[editingIndex]?.textAlign) === 'right') ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700'}`} title="Alinear Derecha"><FiAlignRight size={14}/></button>
                </div>
                
                <textarea 
                  id="slide-content-editor"
                  rows={5}
                  value={activeTab === 'video' ? (generatedContent.video_slides[editingIndex]?.content || generatedContent.video_slides[editingIndex]?.text || '') : (generatedContent.slides[editingIndex]?.content || generatedContent.slides[editingIndex]?.text || '')}
                  onChange={(e) => {
                    const slidesProp = activeTab === 'video' ? 'video_slides' : 'slides';
                    const newSlides = [...generatedContent[slidesProp]];
                    if (newSlides[editingIndex]) {
                      newSlides[editingIndex].content = e.target.value;
                      setGeneratedContent({ ...generatedContent, [slidesProp]: newSlides });
                    }
                  }}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm leading-relaxed"
                />
              </div>
              <button 
                onClick={() => setEditingIndex(null)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      <PreviewModal 
        isOpen={previewIndex !== null} currentIndex={previewIndex}
        total={activeTab === 'video' ? (generatedContent?.video_slides?.length || 0) : (generatedContent?.slides?.length || 0)} 
        slides={activeTab === 'video' ? (generatedContent?.video_slides || []) : (generatedContent?.slides || [])}
        onClose={() => setPreviewIndex(null)} onNavigate={setPreviewIndex}
        renderSlide={(slide, i, isPrev) => (
          <SlideCanvas slide={slide} index={i} isPreview={isPrev} doctor={doctor} doctorLogo={doctorLogoBase64} siteConfig={siteConfig} design={designer.design} canvas={designer.canvas} transform={transformer.state} watermark={watermarkImage} handlers={transformer.handlers} isVideoMode={activeTab === 'video'} showBgImage={showBgImage} />
        )}
      />

      <Modal
        isOpen={isSaveAsModalOpen}
        onClose={() => setIsSaveAsModalOpen(false)}
        title="Guardar Como..."
        size="alert"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ingresa un nombre para el nuevo proyecto:
          </p>
          <input
            type="text"
            autoFocus
            value={saveAsProjectName}
            onChange={(e) => setSaveAsProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveProjectAsConfirm();
            }}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 focus:outline-none dark:text-white"
            placeholder="Nombre del proyecto..."
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsSaveAsModalOpen(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveProjectAsConfirm}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
            >
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Hidden audio elements for playback */}
      <audio ref={audioRef} style={{ display: 'none' }} crossOrigin="anonymous" />
      <audio ref={globalAudioRef} style={{ display: 'none' }} crossOrigin="anonymous" />
      <audio ref={previewAudioRef} style={{ display: 'none' }} crossOrigin="anonymous" />

      {/* Video Editor Modal */}
      {(pendingVideoFile || pendingVideoTarget?.url) && (
        <VideoEditorModal
          file={pendingVideoFile}
          url={pendingVideoTarget?.url}
          initialState={pendingVideoTarget?.initialState}
          onClose={() => {
            setPendingVideoFile(null);
            setPendingVideoTarget(null);
          }}
          onApply={(params) => {
            const { index, isVideoSlide, imgIndex } = pendingVideoTarget;
            const imgId = `${index}-${imgIndex}`;
            
            // Update imagePositions with the new params
            transformer.state.setImagePositions(prev => {
              const pos = prev[imgId] || {};
              const startTime = pos.startTime !== undefined ? pos.startTime : 0;
              const computedDuration = (params.trimEnd - params.trimStart) / params.speed;
              
              return {
                ...prev,
                [imgId]: {
                  ...pos,
                  trimStart: params.trimStart,
                  trimEnd: params.trimEnd,
                  speed: params.speed,
                  isMuted: params.isMuted,
                  endTime: startTime + computedDuration
                }
              };
            });
            setPendingVideoFile(null);
            setPendingVideoTarget(null);
            showToast('Ajustes de video aplicados', 'success');
          }}
        />
      )}
    </div>
  );
}



