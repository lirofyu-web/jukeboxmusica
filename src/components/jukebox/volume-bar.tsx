"use client";

import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VolumeBarProps {
  volume: number;
  isVisible: boolean;
}

export const VolumeBar: React.FC<VolumeBarProps> = ({ volume, isVisible }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
    } else {
      const timer = setTimeout(() => setShow(false), 500); // Aguarda a animação de saída de 500ms
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!show && !isVisible) return null;

  const percentage = Math.round(volume * 100);

  return (
    <div className={cn(
      "fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] transition-all duration-500 ease-out flex flex-col items-center",
      isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-90 pointer-events-none"
    )}>
      <div className="glass-morphism border border-white/10 px-8 py-6 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-8 min-w-[500px]">
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            {percentage === 0 ? <VolumeX className="h-6 w-6 text-red-500" /> : 
             percentage < 50 ? <Volume1 className="h-6 w-6 text-primary" /> : 
             <Volume2 className="h-6 w-6 text-primary" />
            }
          </div>
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">{percentage}%</span>
        </div>

        <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
          <div 
            className="absolute inset-y-0 left-0 bg-primary transition-all duration-300 shadow-[0_0_20px_rgba(249,115,22,0.5)]"
            style={{ width: `${percentage}%` }}
          />
          {/* Marcadores de 25% */}
          <div className="absolute inset-0 flex justify-between px-2 pointer-events-none">
            {[25, 50, 75].map(p => (
              <div key={p} className="h-full w-[1px] bg-white/10" style={{ marginLeft: `${p}%` }} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 text-right">
          <h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Volume</h3>
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Ajuste com as Setas</p>
        </div>
      </div>
      
      {/* Seta indicadora inferior */}
      <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[15px] border-t-zinc-900 mt-[-2px] drop-shadow-2xl" />
    </div>
  );
};
