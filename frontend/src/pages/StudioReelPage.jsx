import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pause, Play, RotateCcw } from 'lucide-react';
import InstagramIaApuReel from '../components/studio/InstagramIaApuReel';

export default function StudioReelPage() {
  const [searchParams] = useSearchParams();
  const isRecordMode = searchParams.get('record') === '1';
  const [playing, setPlaying] = useState(true);
  const [runKey, setRunKey] = useState(0);

  if (isRecordMode) {
    return (
      <div className="h-[1920px] w-[1080px] overflow-hidden bg-slate-950">
        <div className="origin-top-left scale-[2]">
          <InstagramIaApuReel
            key={runKey}
            playing={true}
            loop={false}
            onComplete={() => {
              window.__REEL_DONE__ = true;
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-4 text-white">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-500 cursor-pointer"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? 'Pausar' : 'Reproducir'}
        </button>
        <button
          type="button"
          onClick={() => {
            setRunKey((k) => k + 1);
            setPlaying(true);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-800 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
        >
          <RotateCcw size={14} />
          Reiniciar
        </button>
        <span className="ml-2 text-slate-400">Formato Instagram Reels (9:16)</span>
      </div>

      <div className="origin-top scale-[0.72] sm:scale-[0.82] md:scale-[0.9] rounded-3xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
        <InstagramIaApuReel key={runKey} playing={playing} loop={true} />
      </div>
    </div>
  );
}
