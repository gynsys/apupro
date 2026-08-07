
import { useState, useEffect } from 'react';

export const useMobileFullscreen = (isMobile, generatedContent) => {
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);

  const enterMobileFullscreen = () => {
    setIsMobileFullscreen(true);
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
  };

  const exitMobileFullscreen = () => {
    setIsMobileFullscreen(false);
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
  };

  // Auto-enter logic
  useEffect(() => {
    if (isMobile && generatedContent && generatedContent.slides && generatedContent.slides.length > 0) {
      enterMobileFullscreen();
    } else if (!isMobile) {
      exitMobileFullscreen();
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [isMobile, generatedContent]);

  // Touch Prevention
  useEffect(() => {
    if (isMobileFullscreen) {
      const preventTouchMove = (e) => {
        if (e.target.closest('button, input, textarea, [role="button"], .slide-canvas, #main-slide-canvas, .absolute, .z-10, .z-20, .z-30, .z-40, .z-50, .pointer-events-auto, [data-element], [data-slide-element], [data-contextual-bar]')) {
          return;
        }
        e.preventDefault();
        return false;
      };

      const preventTouchStart = (e) => {
        if (e.target.closest('button, input, textarea, [role="button"], .slide-canvas, #main-slide-canvas, .absolute, .z-10, .z-20, .z-30, .z-40, .z-50, .pointer-events-auto, [data-element], [data-slide-element], [data-contextual-bar]')) {
          return;
        }
        e.preventDefault();
        return false;
      };

      document.addEventListener('touchmove', preventTouchMove, { passive: false });
      document.addEventListener('touchstart', preventTouchStart, { passive: false });

      return () => {
        document.removeEventListener('touchmove', preventTouchMove);
        document.removeEventListener('touchstart', preventTouchStart);
      };
    }
  }, [isMobileFullscreen]);

  return {
    isMobileFullscreen,
    enterMobileFullscreen,
    exitMobileFullscreen
  };
};

