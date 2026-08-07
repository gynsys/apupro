import { useState, useEffect, useRef } from 'react';
import { AUDIO_TRACKS } from '../constants';
import { blogService } from '../../../services/blogService';
import { getImageUrl } from '../../../../../lib/imageUtils';

export const useAudioPlayback = (
  activeTab, isPlaying, setIsPlaying, showToast,
  selectedAudio, setSelectedAudio, customAudioUrl, setCustomAudioUrl, currentVideoSlide,
  globalAudio, setGlobalAudio, globalCustomAudioUrl, setGlobalCustomAudioUrl, audioApplyMode
) => {
  const [prelisteningTrack, setPrelisteningTrack] = useState(null);
  const [userAudios, setUserAudios] = useState([]);
  const [loadingAudios, setLoadingAudios] = useState(false);
  const [volume, setVolume] = useState(0.5); // Default volume to 50%
  
  const audioRef = useRef(null);
  const globalAudioRef = useRef(null);
  const previewAudioRef = useRef(null);

  useEffect(() => {
    loadUserAudios();
  }, []);

  const loadUserAudios = async () => {
    try {
      setLoadingAudios(true);
      const data = await blogService.getSocialAudios();
      setUserAudios(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading user audios:', error);
    } finally {
      setLoadingAudios(false);
    }
  };

  const handleUploadAudio = async (e) => {
    console.log("[Arko360] handleUploadAudio triggered");
    const file = e.target.files?.[0];
    if (!file) {
      console.log("[Arko360] No file selected");
      return;
    }
    console.log("[Arko360] File selected:", file.name);
    try {
      showToast('Subiendo audio...', 'info');
      const response = await blogService.uploadSocialAudio(file);
      console.log("[Arko360] Upload response:", response);
      showToast('Audio subido con éxito', 'success');
      
      const newAudio = response.audio || response; // Fallback if direct object returned
      console.log("[Arko360] New audio object:", newAudio);
      
      if (!newAudio || !newAudio.id) {
        console.error("[Arko360] Invalid response structure:", response);
        throw new Error("Invalid response structure");
      }
      
      setUserAudios(prev => [newAudio, ...prev]);
      
      // Select the new audio automatically
      setSelectedAudio(`User-${newAudio.id}`);
      setCustomAudioUrl(newAudio.url);
      
      return newAudio;
    } catch (error) {
      console.error("[Arko360] Error in handleUploadAudio:", error);
      showToast('Error al subir audio', 'error');
      throw error;
    }
  };

  const handleDeleteAudio = async (audioId) => {
    try {
      await blogService.deleteSocialAudio(audioId);
      setUserAudios(prev => prev.filter(a => a.id !== audioId));
      if (selectedAudio === `User-${audioId}`) {
        setSelectedAudio(null);
        setCustomAudioUrl(null);
      }
      showToast('Audio eliminado', 'success');
    } catch (error) {
      showToast('Error al eliminar audio', 'error');
    }
  };

  const getActiveAudioSrc = (overrideAudio = selectedAudio, overrideCustomUrl = customAudioUrl) => {
    if (!overrideAudio) return '';
    if (overrideAudio === 'Custom' && overrideCustomUrl) return overrideCustomUrl;
    if (overrideAudio && overrideAudio.startsWith('User-')) {
      const audioId = parseInt(overrideAudio.split('-')[1]);
      const audio = userAudios.find(a => a.id === audioId);
      if (audio) return getImageUrl(audio.url);
    }
    return getImageUrl(AUDIO_TRACKS[overrideAudio] || AUDIO_TRACKS['Medical']);
  };

  // Main Audio Effect (Local Slide Audio)
  useEffect(() => {
    if (audioRef.current) {
      if (activeTab === 'video' && isPlaying && selectedAudio) {
        const src = getActiveAudioSrc(selectedAudio, customAudioUrl);
        if (src && audioRef.current.src !== src) {
          audioRef.current.src = src;
          audioRef.current.load();
        }
      } else if (!isPlaying || !selectedAudio) {
        audioRef.current.pause();
      }
    }
  }, [activeTab, isPlaying, selectedAudio, customAudioUrl, userAudios, currentVideoSlide]);

  // Global Audio Effect
  useEffect(() => {
    if (globalAudioRef.current) {
      if (activeTab === 'video' && isPlaying && globalAudio) {
        const src = getActiveAudioSrc(globalAudio, globalCustomAudioUrl);
        if (src && globalAudioRef.current.src !== src) {
          globalAudioRef.current.src = src;
          globalAudioRef.current.load();
        }
      } else if (!isPlaying || !globalAudio) {
        globalAudioRef.current.pause();
      }
    }
  }, [activeTab, isPlaying, globalAudio, globalCustomAudioUrl, userAudios]);

  // Prelistening Effect
  useEffect(() => {
    if (previewAudioRef.current) {
      if (prelisteningTrack) {
        setIsPlaying(false);
        let src = '';
        if (prelisteningTrack === 'Custom') {
          src = customAudioUrl;
        } else if (prelisteningTrack.startsWith('User-')) {
          const audioId = parseInt(prelisteningTrack.split('-')[1]);
          const audio = userAudios.find(a => a.id === audioId);
          src = audio ? getImageUrl(audio.url) : '';
        } else {
          src = getImageUrl(AUDIO_TRACKS[prelisteningTrack]);
        }
        
        if (src) {
          previewAudioRef.current.src = src;
          previewAudioRef.current.load();
          previewAudioRef.current.play().catch(e => console.log("Error in preview audio:", e));
        }
      } else {
        previewAudioRef.current.pause();
      }
    }
  }, [prelisteningTrack]);

  // Sync volume state with actual audio elements
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    if (globalAudioRef.current) {
      globalAudioRef.current.volume = volume;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.volume = volume;
    }
  }, [volume]);

  return {
    audioRef,
    globalAudioRef,
    previewAudioRef,
    selectedAudio,
    setSelectedAudio,
    customAudioUrl,
    setCustomAudioUrl,
    prelisteningTrack,
    setPrelisteningTrack,
    getActiveAudioSrc,
    userAudios,
    loadingAudios,
    handleUploadAudio,
    handleDeleteAudio,
    volume,
    setVolume
  };
};

