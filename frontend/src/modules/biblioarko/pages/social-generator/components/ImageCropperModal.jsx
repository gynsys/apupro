import React, { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FiCrop, FiCheck, FiX } from 'react-icons/fi';

export const ImageCropperModal = ({ isOpen, onClose, imageUrl, onCropComplete }) => {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [aspect, setAspect] = useState(undefined); // undefined = Libre (estilo Office)
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef(null);

  function onImageLoad(e) {
    const { width, height } = e.currentTarget;
    const initialCrop = {
      unit: '%',
      x: 10,
      y: 10,
      width: 80,
      height: 80,
    };
    setCrop(initialCrop);
  }

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) {
      onClose();
      return;
    }

    setIsProcessing(true);
    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const cropWidth = Math.round(completedCrop.width * scaleX);
      const cropHeight = Math.round(completedCrop.height * scaleY);

      if (cropWidth > 0 && cropHeight > 0) {
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            image,
            Math.round(completedCrop.x * scaleX),
            Math.round(completedCrop.y * scaleY),
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight
          );
          const croppedImage = canvas.toDataURL('image/png');
          onCropComplete(croppedImage);
        }
      }
    } catch (e) {
      console.error('[Arko360] Error al recortar imagen:', e);
    }
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen || !imageUrl) return null;

  const aspectOptions = [
    { label: 'Libre (Office)', value: undefined },
    { label: '1:1 (Cuadrado)', value: 1 },
    { label: '4:5 (Vertical)', value: 4 / 5 },
    { label: '3:4', value: 3 / 4 },
    { label: '16:9 (Horizontal)', value: 16 / 9 },
    { label: '9:16 (Story/Reel)', value: 9 / 16 },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 shrink-0">
          <h2 className="text-sm font-black uppercase text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <FiCrop size={16} className="text-indigo-500" />
            Recortar Imagen
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-gray-400 transition-colors">
            <FiX size={20} />
          </button>
        </div>

        {/* Aspect Ratio Options */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-xs font-bold text-gray-500 uppercase mr-1">Proporción:</span>
          {aspectOptions.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                setAspect(opt.value);
                if (imgRef.current && opt.value) {
                  const { width, height } = imgRef.current;
                  const newCrop = centerCrop(
                    makeAspectCrop({ unit: '%', width: 80 }, opt.value, width, height),
                    width,
                    height
                  );
                  setCrop(newCrop);
                }
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                aspect === opt.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Cropper Container */}
        <div className="flex-1 overflow-auto p-4 bg-gray-950 flex items-center justify-center min-h-[350px]">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            className="max-h-[60vh]"
          >
            <img
              ref={imgRef}
              alt="Recortar"
              src={imageUrl}
              onLoad={onImageLoad}
              crossOrigin="anonymous"
              style={{ maxHeight: '60vh', objectFit: 'contain' }}
            />
          </ReactCrop>
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-400">
            💡 Arrastra los tiradores en esquinas o bordes laterales para recortar.
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FiCheck size={18} /> {isProcessing ? 'Procesando...' : 'Aplicar Recorte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
