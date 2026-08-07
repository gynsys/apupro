import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiCheck, FiScissors, FiClock, FiVolume2, FiVolumeX } from 'react-icons/fi';

const VideoEditorModal = ({ file, url: providedUrl, initialState, onClose, onApply }) => {
  const videoRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(initialState?.trimStart || 0);
  const [endTime, setEndTime] = useState(initialState?.trimEnd || 0);
  const [speed, setSpeed] = useState(initialState?.speed || 1);
  const [isMuted, setIsMuted] = useState(initialState?.isMuted || false);
  const [videoUrl, setVideoUrl] = useState(providedUrl || null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (providedUrl) {
      setVideoUrl(providedUrl);
    }
  }, [file, providedUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (!initialState?.trimEnd) {
        setEndTime(dur);
      }
    }
  };

  const handleApply = () => {
    onApply({
      trimStart: startTime,
      trimEnd: endTime,
      speed: speed,
      isMuted: isMuted
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <h3 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
            <FiScissors className="text-indigo-500" />
            Editor de Video
          </h3>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* Video Preview */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center shadow-inner">
            {videoUrl && (
              <video 
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full h-full object-contain"
                onLoadedMetadata={handleLoadedMetadata}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trim Controls */}
            <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FiScissors /> Recortar (Segundos)
              </h4>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Inicio</label>
                  <input 
                    type="number" 
                    min="0" 
                    max={endTime} 
                    step="0.1"
                    value={startTime}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setStartTime(val);
                      if (videoRef.current) videoRef.current.currentTime = val;
                    }}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Fin</label>
                  <input 
                    type="number" 
                    min={startTime} 
                    max={duration} 
                    step="0.1"
                    value={endTime}
                    onChange={(e) => setEndTime(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Tiempo total en escena:</span>
                <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                  {((endTime - startTime) / speed).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Speed Controls */}
            <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FiClock /> Velocidad
              </h4>
              <select 
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full px-3 py-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value={0.5}>0.5x (Lento)</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x (Normal)</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2.0x (Rápido)</option>
              </select>
            </div>
          </div>

          {/* Audio Controls */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isMuted ? 'bg-red-100 text-red-500' : 'bg-indigo-100 text-indigo-500'}`}>
                {isMuted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Audio Original</h4>
                <p className="text-xs text-gray-500">
                  {isMuted ? 'El audio original no sonará en la exportación' : 'Se incluirá el audio de este video en la exportación'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${!isMuted ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${!isMuted ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-3">
          
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2 hover:shadow-lg"
            >
              <FiCheck /> Aplicar Ajustes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoEditorModal;
