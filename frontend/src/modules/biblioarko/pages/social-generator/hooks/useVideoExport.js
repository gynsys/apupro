import { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import fixWebmDuration from 'fix-webm-duration';
import { blogService } from '../../../services/blogService';
import { isCapacitor, downloadFile, openExternalFile } from '../../../../../utils/platform';

export const useVideoExport = (
  generatedContent, videoStyles, slideDuration, transitionType, transitionDuration,
  selectedPost, audioRef, globalAudioRef, getActiveAudioSrc, showToast,
  designer, transformState
) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('idle');

  const abortRef = useRef(false);
  const blobUrlsRef = useRef([]);
  const audioCtxRef = useRef(null);

  const safeSetState = useCallback((setter, val) => {
    setter(val);
  }, []);

  const revokeAllBlobUrls = useCallback(() => {
    blobUrlsRef.current.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) {}
    });
    blobUrlsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current = true;
      revokeAllBlobUrls();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [revokeAllBlobUrls]);

  const handleExportVideo = async () => {
    const scenes = generatedContent?.video_slides || generatedContent?.slides;
    if (!scenes || !Array.isArray(scenes)) {
      showToast('No hay escenas para exportar', 'error');
      return;
    }

    // ============================================================
    // PASO 0: CREAR AudioContext INMEDIATAMENTE TRAS EL CLIC DEL USUARIO
    // (Crucial para que Chrome no lo ponga en estado "suspended")
    // ============================================================
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const audioDest = audioCtx.createMediaStreamDestination();
    let hasAudio = false;

    // Conectar Audio de Fondo Global
    const exportBgAudio = new Audio();
    exportBgAudio.crossOrigin = 'anonymous';
    try {
      const bgSource = audioCtx.createMediaElementSource(exportBgAudio);
      bgSource.connect(audioDest);
      hasAudio = true;
    } catch (e) {
      console.error('[Arko360] Error conectando audio global:', e);
    }

    // Conectar Audio Local de Diapositiva
    const exportLocalAudio = new Audio();
    exportLocalAudio.crossOrigin = 'anonymous';
    try {
      const localSource = audioCtx.createMediaElementSource(exportLocalAudio);
      localSource.connect(audioDest);
      hasAudio = true;
    } catch (e) {
      console.error('[Arko360] Error conectando audio local:', e);
    }

    // Silenciar previews del editor para evitar duplicidad de sonido
    if (audioRef.current) audioRef.current.pause();
    if (globalAudioRef.current) globalAudioRef.current.pause();

    abortRef.current = false;
    safeSetState(setIsExporting, true);
    safeSetState(setExportProgress, 0);
    safeSetState(setExportStatus, 'capturing');

    let actionButtons = [];
    let originalPage = 0;
    let capturedFrames = [];
    let slideVideos = [];
    let slideDurations = [];

    try {
      // ============================================================
      // PASO 1: CAPTURAR TODOS LOS FRAMES Y PREPARAR RECURSOS
      // ============================================================
      const isVideoMode = generatedContent?.video_slides ? true : false;
      const scaleX = 720 / 410;
      const scaleY = 1280 / (isVideoMode ? 728 : 410);

      actionButtons = document.querySelectorAll('.slide-actions');
      actionButtons.forEach(btn => (btn.style.display = 'none'));

      originalPage = designer.canvas.currentSlidePage;
      designer.canvas.setSelectedExtraId(null);
      designer.canvas.setSelectedImageId(null);
      designer.canvas.setSelectedContentIndex(null);
      designer.canvas.setIsExportMode(true);

      for (let i = 0; i < scenes.length; i++) {
        if (abortRef.current) throw new Error('Export cancelled');

        designer.canvas.setCurrentSlidePage(i);
        await new Promise(resolve => setTimeout(resolve, 1000));

        const customImages = scenes[i].customImages || [];
        const currentSlideVids = [];
        let maxVidDur = 0;

        const tEnd = scenes[i]?.titleEndTime !== undefined ? scenes[i].titleEndTime : slideDuration;
        if (tEnd > maxVidDur) maxVidDur = tEnd;

        const cEnd = scenes[i]?.contentEndTime !== undefined ? scenes[i].contentEndTime : slideDuration;
        if (cEnd > maxVidDur) maxVidDur = cEnd;

        const extraEls = designer.canvas.extraElements[i] || [];
        extraEls.forEach(el => {
          const eEnd = el.endTime !== undefined ? el.endTime : slideDuration;
          if (eEnd > maxVidDur) maxVidDur = eEnd;
        });

        for (let imgIndex = 0; imgIndex < customImages.length; imgIndex++) {
          const img = customImages[imgIndex];
          const isVideo = img && (
            img.startsWith('data:video') || 
            img.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i)
          );

          if (isVideo) {
            const imgId = `${i}-${imgIndex}`;
            const pos = transformState?.imagePositions?.[imgId] || {};
            const isMuted = pos.isMuted || false;

            const vid = document.createElement('video');
            vid.crossOrigin = 'anonymous';
            vid.muted = isMuted; // Permitir salida de audio solo si no esta silenciado
            vid.loop = true;
            vid.playsInline = true;

            try {
              const res = await fetch(img);
              const blob = await res.blob();
              const blobUrl = URL.createObjectURL(blob);
              blobUrlsRef.current.push(blobUrl);
              vid.src = blobUrl;
            } catch (e) {
              vid.src = img;
            }

            await new Promise((resolve) => {
              const timeout = setTimeout(resolve, 5000);
              if (vid.readyState >= 1) {
                clearTimeout(timeout);
                resolve();
              } else {
                vid.onloadedmetadata = () => { clearTimeout(timeout); resolve(); };
                vid.onerror = () => { clearTimeout(timeout); resolve(); };
              }
            });

            // Conectar audio del video al WebAudio si no esta muteado
            if (!isMuted) {
              try {
                const vidSource = audioCtx.createMediaElementSource(vid);
                vidSource.connect(audioDest);
                hasAudio = true;
              } catch (e) {
                console.error('[Arko360] Error conectando audio de video insertado:', e);
              }
            }

            const size = transformState?.imageSizes?.[imgId] || 100;
            const rot = transformState?.imageRotations?.[imgId] || 0;

            let endT = pos.endTime !== undefined ? pos.endTime : slideDuration;
            if (pos.endTime === undefined && vid.duration && !isNaN(vid.duration) && vid.duration !== Infinity) {
              endT = (pos.startTime || 0) + vid.duration;
            }
            if (endT > maxVidDur) maxVidDur = endT;

            currentSlideVids.push({ vid, pos, size, rot });
          } else if (img) {
            const imgId = `${i}-${imgIndex}`;
            const pos = transformState?.imagePositions?.[imgId] || { x: 50, y: 70 };
            const endT = pos.endTime !== undefined ? pos.endTime : slideDuration;
            if (endT > maxVidDur) maxVidDur = endT;
          }
        }

        if (maxVidDur < 1) maxVidDur = 1;
        slideVideos.push(currentSlideVids);
        slideDurations.push(maxVidDur);

        const container = document.getElementById('main-slide-canvas');
        const slideNode = container?.firstElementChild || container;

        if (!slideNode) {
          capturedFrames.push([{ start: 0, end: maxVidDur, canvas: null }]);
          continue;
        }

        const videoDOMs = slideNode.querySelectorAll('video');
        videoDOMs.forEach(v => { v.style.display = 'none'; });

        const slide = scenes[i];
        let timeEvents = [0, maxVidDur];
        if (slide.titleStartTime !== undefined) timeEvents.push(slide.titleStartTime);
        if (slide.titleEndTime !== undefined) timeEvents.push(slide.titleEndTime);
        if (slide.contentStartTime !== undefined) timeEvents.push(slide.contentStartTime);
        if (slide.contentEndTime !== undefined) timeEvents.push(slide.contentEndTime);

        extraEls.forEach(el => {
          if (el.startTime !== undefined) timeEvents.push(el.startTime);
          if (el.endTime !== undefined) timeEvents.push(el.endTime);
        });

        slide.customImages?.forEach((img, imgIdx) => {
          const imgId = `${i}-${imgIdx}`;
          const pos = transformState?.imagePositions?.[imgId] || {};
          if (pos.startTime !== undefined) timeEvents.push(pos.startTime);
          if (pos.endTime !== undefined) timeEvents.push(pos.endTime);
        });

        timeEvents = [...new Set(timeEvents.filter(t => t >= 0 && t <= maxVidDur))].sort((a, b) => a - b);

        const snapshots = [];
        const titleNode = slideNode.querySelector('[data-export-id="title"]');
        const contentNode = slideNode.querySelector('[data-export-id="content"]');
        const extraNodes = {};
        extraEls.forEach(el => {
          const node = slideNode.querySelector(`[data-export-id="extra-${el.id}"]`);
          if (node) extraNodes[el.id] = node;
        });
        const imgNodes = {};
        slide.customImages?.forEach((img, imgIdx) => {
          const imgId = `${i}-${imgIdx}`;
          const node = slideNode.querySelector(`[data-export-id="img-${imgId}"]`);
          if (node) imgNodes[imgId] = node;
        });

        for (let t = 0; t < timeEvents.length - 1; t++) {
          if (abortRef.current) throw new Error('Export cancelled');

          const start = timeEvents[t];
          const end = timeEvents[t + 1];
          if (end - start < 0.01) continue;

          const mid = start + 0.01;

          if (titleNode) {
            const tStart = slide.titleStartTime !== undefined ? slide.titleStartTime : 0;
            const tEnd = slide.titleEndTime !== undefined ? slide.titleEndTime : maxVidDur;
            titleNode.style.opacity = (mid >= tStart && mid <= tEnd) ? '1' : '0';
          }
          if (contentNode) {
            const cStart = slide.contentStartTime !== undefined ? slide.contentStartTime : 0;
            const cEnd = slide.contentEndTime !== undefined ? slide.contentEndTime : maxVidDur;
            contentNode.style.opacity = (mid >= cStart && mid <= cEnd) ? '1' : '0';
          }
          extraEls.forEach(el => {
            if (extraNodes[el.id]) {
              const eStart = el.startTime !== undefined ? el.startTime : 0;
              const eEnd = el.endTime !== undefined ? el.endTime : maxVidDur;
              extraNodes[el.id].style.opacity = (mid >= eStart && mid <= eEnd) ? '1' : '0';
            }
          });
          slide.customImages?.forEach((img, imgIdx) => {
            const imgId = `${i}-${imgIdx}`;
            if (imgNodes[imgId]) {
              const pos = transformState?.imagePositions?.[imgId] || {};
              const iStart = pos.startTime !== undefined ? pos.startTime : 0;
              const iEnd = pos.endTime !== undefined ? pos.endTime : maxVidDur;
              imgNodes[imgId].style.opacity = (mid >= iStart && mid <= iEnd) ? (pos.opacity !== undefined ? pos.opacity : '1') : '0';
            }
          });

          await new Promise(resolve => setTimeout(resolve, 50));

          const capturedCanvas = await html2canvas(slideNode, {
            useCORS: true,
            scale: 2,
            backgroundColor: designer.design?.bgColor || '#ffffff',
            logging: false,
            allowTaint: true,
            imageTimeout: 15000,
          });

          snapshots.push({ start, end, canvas: capturedCanvas });
        }

        videoDOMs.forEach(v => { v.style.display = ''; });
        if (titleNode) titleNode.style.opacity = '1';
        if (contentNode) contentNode.style.opacity = '1';
        extraEls.forEach(el => { if (extraNodes[el.id]) extraNodes[el.id].style.opacity = '1'; });
        slide.customImages?.forEach((img, imgIdx) => {
          const imgId = `${i}-${imgIdx}`;
          if (imgNodes[imgId]) {
            const pos = transformState?.imagePositions?.[imgId] || {};
            imgNodes[imgId].style.opacity = pos.opacity !== undefined ? pos.opacity : '1';
          }
        });

        capturedFrames.push(snapshots.length > 0 ? snapshots : [{ start: 0, end: maxVidDur, canvas: null }]);
        safeSetState(setExportProgress, Math.round(((i + 1) / scenes.length) * 40));
      }

      actionButtons.forEach(btn => (btn.style.display = 'flex'));
      designer.canvas.setCurrentSlidePage(originalPage);
      designer.canvas.setIsExportMode(false);

      // ============================================================
      // PASO 2: COMPONER Y GRABAR VIDEO
      // ============================================================
      if (abortRef.current) throw new Error('Export cancelled');
      safeSetState(setExportStatus, 'rendering');

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = 720;
      outputCanvas.height = 1280;
      const ctx = outputCanvas.getContext('2d');

      const videoStream = outputCanvas.captureStream(30);

      const combinedTracks = [...videoStream.getVideoTracks()];
      if (hasAudio && audioDest.stream.getAudioTracks().length > 0) {
        combinedTracks.push(...audioDest.stream.getAudioTracks());
      }
      const combinedStream = new MediaStream(combinedTracks);

      let mimeType = 'video/webm;codecs=vp9,opus';
      let extension = 'webm';
      let blobType = 'video/webm';

      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
        mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
        extension = 'mp4';
        blobType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        extension = 'mp4';
        blobType = 'video/mp4';
      }

      const recorder = new MediaRecorder(combinedStream, { 
        mimeType,
        videoBitsPerSecond: 1500000 
      });

      const chunks = [];
      recorder.ondataavailable = e => { 
        if (e.data && e.data.size > 0) chunks.push(e.data); 
      };

      const totalSlideDuration = slideDurations.reduce((a, b) => a + b, 0);
      const totalTransitionDuration = (capturedFrames.length - 1) * transitionDuration;
      const totalDuration = totalSlideDuration + totalTransitionDuration;

      recorder.onstop = async () => {
        exportBgAudio?.pause();
        exportBgAudio?.removeAttribute('src');
        exportBgAudio?.load();
        exportLocalAudio?.pause();
        exportLocalAudio?.removeAttribute('src');
        exportLocalAudio?.load();

        slideVideos.forEach(vids => {
          vids.forEach(v => {
            try {
              v.vid.pause();
              v.vid.removeAttribute('src');
              v.vid.load();
            } catch (e) {}
          });
        });

        revokeAllBlobUrls();
        if (audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
        audioCtxRef.current = null;

        safeSetState(setIsExporting, false);
        safeSetState(setExportStatus, 'downloading');

        const rawBlob = new Blob(chunks, { type: blobType });
        const durationMs = Math.round(totalDuration * 1000);

        let blob = rawBlob;
        if (typeof fixWebmDuration === 'function' && durationMs > 0) {
          try {
            blob = await new Promise((resolve) => {
              fixWebmDuration(rawBlob, durationMs, (fixedBlob) => resolve(fixedBlob));
            });
          } catch (fixErr) {
            blob = rawBlob;
          }
        }

        const filename = `video_arko360_${selectedPost?.id || 'export'}.${extension}`;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        try {
          if (isCapacitor()) {
            const { file_id, extension: ext } = await blogService.uploadForDownload(blob, filename);
            const apiBase = (
              import.meta.env.VITE_API_BASE_URL || 'https://api.arko360.net/api/v1'
            ).replace(/\/$/, '');
            openExternalFile(`${apiBase}/blog/download/${file_id}?ext=${ext}`);
          } else if (isMobile) {
            const { file_id, extension: ext } = await blogService.uploadForDownload(blob, filename);
            const apiBase = (
              import.meta.env.VITE_API_BASE_URL || 'https://api.arko360.net/api/v1'
            ).replace(/\/$/, '');
            window.location.href = `${apiBase}/blog/download/${file_id}?ext=${ext}`;
          } else {
            downloadFile(blob, filename);
          }
          safeSetState(setExportStatus, 'done');
          setTimeout(() => safeSetState(setExportStatus, 'idle'), 5000);
        } catch (err) {
          console.error('[Arko360] Download error:', err);
          downloadFile(blob, filename);
          safeSetState(setExportStatus, 'done');
          setTimeout(() => safeSetState(setExportStatus, 'idle'), 5000);
        }
      };

      recorder.onerror = (e) => {
        console.error('[Arko360] MediaRecorder error:', e);
        safeSetState(setIsExporting, false);
        safeSetState(setExportStatus, 'idle');
        showToast('Error en la grabación del video', 'error');
      };

      // Helper: dibujar slide en el canvas
      const drawSlide = (frameImg, vids) => {
        if (frameImg) {
          ctx.drawImage(frameImg, 0, 0, outputCanvas.width, outputCanvas.height);
        }
        vids.forEach(v => {
          ctx.save();
          const widthVal = typeof v.size === 'object' ? v.size.width : v.size;
          const heightVal = typeof v.size === 'object' ? v.size.height : v.size;
          const dSizeX = widthVal * scaleX;
          const dSizeY = heightVal * scaleY;
          const cx = (v.pos.x / 100) * outputCanvas.width;
          const cy = (v.pos.y / 100) * outputCanvas.height;

          ctx.translate(cx, cy);
          ctx.rotate(v.rot * Math.PI / 180);
          ctx.translate(-dSizeX / 2, -dSizeY / 2);

          // Aplicar sombra si existe
          if (v.pos.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 25 * scaleX;
            ctx.shadowOffsetY = 10 * scaleY;
          }

          // Aplicar border-radius
          const borderRadiusStr = designer.design?.imageBorderRadius || '0px';
          const radiusPixels = (parseInt(borderRadiusStr) || 0) * scaleX;
          
          if (radiusPixels > 0) {
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(0, 0, dSizeX, dSizeY, radiusPixels);
            } else {
              // Fallback para navegadores antiguos
              ctx.rect(0, 0, dSizeX, dSizeY);
            }
            ctx.clip();
          }

          if (v.vid.videoWidth && v.vid.videoHeight) {
            const containerRatio = dSizeX / dSizeY;
            const vidRatio = v.vid.videoWidth / v.vid.videoHeight;
            let drawW = dSizeX;
            let drawH = dSizeY;
            let offsetX = 0;
            let offsetY = 0;

            if (vidRatio > containerRatio) {
              // Video aspect ratio is wider than container. Width is 100%, height is smaller (object-contain logic)
              drawH = dSizeX / vidRatio;
              offsetY = (dSizeY - drawH) / 2;
            } else {
              // Video aspect ratio is taller than container. Height is 100%, width is smaller (object-contain logic)
              drawW = dSizeY * vidRatio;
              offsetX = (dSizeX - drawW) / 2;
            }
            
            ctx.drawImage(v.vid, 0, 0, v.vid.videoWidth, v.vid.videoHeight, offsetX, offsetY, drawW, drawH);
          }
          ctx.restore();
        });
      };

      // Audio Global setup
      let currentPlayingAudioSrc = null;
      const globalAudioSrc = getActiveAudioSrc(
        generatedContent?.videoSettings?.globalAudio, 
        generatedContent?.videoSettings?.globalCustomAudioUrl
      );
      if (globalAudioSrc) {
        exportBgAudio.src = globalAudioSrc;
        exportBgAudio.currentTime = 0;
        exportBgAudio.play().catch(e => console.log('Global Audio play error', e));
      }

      const startSlideMedia = (sIdx) => {
        const vids = slideVideos[sIdx] || [];
        vids.forEach(v => {
          v.vid.currentTime = v.pos.trimStart !== undefined ? v.pos.trimStart : 0;
          v.vid.playbackRate = v.pos.speed !== undefined ? v.pos.speed : 1;
          v.vid.play().catch(e => console.log('video play error', e));
        });

        const slide = scenes[sIdx];
        const audioSrc = getActiveAudioSrc(slide.audio, slide.customAudioUrl);

        if (audioSrc) {
          if (currentPlayingAudioSrc !== audioSrc) {
            currentPlayingAudioSrc = audioSrc;
            exportLocalAudio.src = audioSrc;
            exportLocalAudio.currentTime = 0;
            exportLocalAudio.play().catch(e => console.log('Local Audio play error', e));
          } else if (exportLocalAudio.paused) {
            exportLocalAudio.currentTime = 0;
            exportLocalAudio.play().catch(e => console.log('Local Audio play error', e));
          }
        } else {
          currentPlayingAudioSrc = null;
          exportLocalAudio.pause();
        }
      };

      // Arrancar grabación
      recorder.start(100);

      // Render Loop Determinista
      await new Promise((resolve, reject) => {
        let slideIdx = 0;
        let prevSlideLastCanvas = null;

        if (capturedFrames.length === 0) { 
          resolve(); 
          return; 
        }

        let startedMediaForSlide = 0;
        startSlideMedia(0);
        const startTime = performance.now();

        const renderFrame = () => {
          if (abortRef.current) {
            reject(new Error('Export cancelled'));
            return;
          }

          const now = performance.now();
          const videoTime = (now - startTime) / 1000;

          if (videoTime >= totalDuration) {
            resolve();
            return;
          }

          let accumulatedTime = 0;
          let currentSlideIdx = 0;
          let slideStartTime = 0;

          for (let s = 0; s < capturedFrames.length; s++) {
            const slideDur = slideDurations[s];
            const transitionTime = s > 0 ? transitionDuration : 0;

            if (videoTime < accumulatedTime + transitionTime + slideDur) {
              currentSlideIdx = s;
              slideStartTime = accumulatedTime + transitionTime;
              break;
            }
            accumulatedTime += transitionTime + slideDur;
          }

          if (currentSlideIdx !== slideIdx) {
            const prevVids = slideVideos[slideIdx] || [];
            prevVids.forEach(v => v.vid.pause());

            prevSlideLastCanvas = capturedFrames[slideIdx]?.[
              capturedFrames[slideIdx].length - 1
            ]?.canvas || null;

            slideIdx = currentSlideIdx;
            // Solo iniciar media del nuevo slide si NO estamos en transición
            const slideElapsed = videoTime - slideStartTime;
            if (slideIdx < capturedFrames.length && slideElapsed >= transitionDuration) {
              if (startedMediaForSlide !== slideIdx) {
                startSlideMedia(slideIdx);
                startedMediaForSlide = slideIdx;
              }
            }
          }

          const slideElapsed = videoTime - slideStartTime;
          // Si estamos en transición, iniciar media del nuevo slide al finalizar la misma
          if (slideIdx > 0 && slideElapsed >= transitionDuration && startedMediaForSlide !== slideIdx) {
            startSlideMedia(slideIdx);
            startedMediaForSlide = slideIdx;
          }

          const slideDur = slideDurations[slideIdx];
          const currentSlideSnapshots = capturedFrames[slideIdx] || [];
          const currentVids = slideVideos[slideIdx] || [];
          const prevVids = slideIdx > 0 ? (slideVideos[slideIdx - 1] || []) : [];

          const currentSnap = currentSlideSnapshots.find(
            s => slideElapsed >= s.start && slideElapsed <= s.end
          ) || currentSlideSnapshots[currentSlideSnapshots.length - 1];

          const currentFrameCanvas = currentSnap ? currentSnap.canvas : null;

          ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
          ctx.fillStyle = designer.design?.bgColor || '#ffffff';
          ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

          const effectiveTransitionDuration = transitionDuration > 0.001 ? transitionDuration : 0;
          const inTransition = effectiveTransitionDuration > 0 && 
                               slideElapsed < effectiveTransitionDuration && 
                               prevSlideLastCanvas !== null && 
                               slideIdx > 0;

          if (inTransition) {
            const rawProgress = slideElapsed / effectiveTransitionDuration;
            const progress = Math.max(0.001, Math.min(0.999, rawProgress));
            const exitProgress = 1 - progress;

            ctx.save();
            if (transitionType === 'fade') {
              ctx.globalAlpha = exitProgress;
              drawSlide(prevSlideLastCanvas, prevVids);
            } else if (transitionType === 'slide') {
              ctx.translate(-outputCanvas.width * progress, 0);
              drawSlide(prevSlideLastCanvas, prevVids);
            } else if (transitionType === 'zoom') {
              ctx.translate(outputCanvas.width / 2, outputCanvas.height / 2);
              ctx.scale(1 + progress, 1 + progress);
              ctx.globalAlpha = exitProgress;
              ctx.translate(-outputCanvas.width / 2, -outputCanvas.height / 2);
              drawSlide(prevSlideLastCanvas, prevVids);
            }
            ctx.restore();

            ctx.save();
            if (transitionType === 'fade') {
              ctx.globalAlpha = progress;
              drawSlide(currentFrameCanvas, currentVids);
            } else if (transitionType === 'slide') {
              ctx.translate(outputCanvas.width * exitProgress, 0);
              drawSlide(currentFrameCanvas, currentVids);
            } else if (transitionType === 'zoom') {
              ctx.translate(outputCanvas.width / 2, outputCanvas.height / 2);
              ctx.scale(1 + (1 - progress) * 0.2, 1 + (1 - progress) * 0.2);
              ctx.globalAlpha = progress;
              ctx.translate(-outputCanvas.width / 2, -outputCanvas.height / 2);
              drawSlide(currentFrameCanvas, currentVids);
            }
            ctx.restore();
          } else {
            drawSlide(currentFrameCanvas, currentVids);
          }

          safeSetState(setExportProgress, 40 + Math.min(60, Math.round((videoTime / totalDuration) * 60)));
          requestAnimationFrame(renderFrame);
        };

        requestAnimationFrame(renderFrame);
      });

      recorder.stop();
    } catch (err) {
      console.error('[Arko360] Error durante la exportación de video:', err);
      actionButtons.forEach(btn => (btn.style.display = 'flex'));
      designer.canvas.setCurrentSlidePage(originalPage);
      designer.canvas.setIsExportMode(false);
      revokeAllBlobUrls();
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
      audioCtxRef.current = null;
      safeSetState(setIsExporting, false);
      safeSetState(setExportStatus, 'idle');
      showToast('Ocurrió un error al exportar el video: ' + (err.message || err), 'error');
    }
  };

  return {
    isExporting,
    exportProgress,
    exportStatus,
    handleExportVideo
  };
};
