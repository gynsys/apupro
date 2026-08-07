
import { useState, useEffect } from 'react';

export const useVideoPlayback = (activeTab, generatedContent, isExporting, slideDuration) => {
  const [currentVideoSlide, setCurrentVideoSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval;
    if (activeTab === 'video' && generatedContent?.video_slides && isPlaying && !isExporting) {
      interval = setInterval(() => {
        setCurrentVideoSlide((prev) => (prev + 1) % generatedContent.video_slides.length);
      }, slideDuration * 1000);
    }
    return () => clearInterval(interval);
  }, [activeTab, generatedContent, isPlaying, isExporting, slideDuration]);

  return {
    currentVideoSlide,
    setCurrentVideoSlide,
    isPlaying,
    setIsPlaying
  };
};

