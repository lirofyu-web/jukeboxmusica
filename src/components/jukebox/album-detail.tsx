
"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Album, Track } from '@/lib/jukebox-data';
import { ArrowLeft, Music } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface AlbumDetailProps {
  album: Album;
  onBack: () => void;
  onSelectTrack: (track: Track) => void;
  currentTrackId?: string;
}

export const AlbumDetail: React.FC<AlbumDetailProps> = ({ album, onBack, onSelectTrack, currentTrackId }) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusedElement = listRef.current?.children[focusedIndex] as HTMLElement;
    if (focusedElement) {
      focusedElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [focusedIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp': 
        e.preventDefault(); 
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev)); 
        break;
      case 'ArrowDown': 
        e.preventDefault(); 
        setFocusedIndex(prev => (prev < album.tracks.length - 1 ? prev + 1 : prev)); 
        break;
      case 'Enter': 
        e.preventDefault(); 
        onSelectTrack(album.tracks[focusedIndex]);
        break;
      case 'Escape': 
      case 'Backspace':
        e.preventDefault(); 
        onBack(); 
        break;
    }
  }, [focusedIndex, album.tracks, onBack, onSelectTrack]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-full w-full animate-in fade-in zoom-in-95 duration-500 bg-black overflow-hidden selection:bg-none" suppressHydrationWarning>
      {/* Esquerda: Capa com Glassmorphism */}
      <div className="w-[38%] p-12 glass-morphism border-r border-white/5 flex flex-col justify-center items-center gap-10 h-full relative z-10" suppressHydrationWarning>
        <div className="flex items-center gap-4 text-primary/40 font-black text-[9px] uppercase tracking-[0.4em] self-start absolute top-10 left-10 group cursor-pointer" onClick={onBack}>
          <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <ArrowLeft className="h-3 w-3" />
          </div>
          <span>[BACK] Voltar</span>
        </div>
        
        <div className="relative w-full max-w-[340px] aspect-square rounded-sm overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,1)] border border-white/10 group">
          <Image 
            src={album.coverUrl} 
            alt={album.title}
            fill
            unoptimized={true}
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        <div className="text-center px-4 max-w-full">
          <h2 className="text-4xl font-black gold-gradient-text uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl break-words">
            {album.title}
          </h2>
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-primary/20"></span>
            <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[10px] opacity-80">
              {album.artist}
            </p>
            <span className="h-px w-8 bg-primary/20"></span>
          </div>
        </div>
      </div>

      {/* Direita: Lista de Faixas com Estilo Digital */}
      <div className="flex-1 flex flex-col p-10 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.05),transparent_50%)] h-full overflow-hidden" suppressHydrationWarning>
        <div className="mb-8 flex items-end justify-between border-b border-white/5 pb-4">
          <h3 className="text-primary font-black uppercase tracking-[0.5em] text-[10px]">Lista de Faixas</h3>
          <span className="text-zinc-600 font-mono text-[10px] font-bold uppercase">{album.tracks.length} ITENS</span>
        </div>

        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div ref={listRef} className="flex flex-col gap-3 pb-40">
            {album.tracks.map((track, idx) => (
              <div 
                key={`${track.id}-${idx}`} 
                className={cn(
                  "relative w-full flex items-center justify-between px-8 py-5 rounded-sm transition-all duration-300 border-l-[6px] group",
                  focusedIndex === idx 
                    ? "bg-primary border-white text-black translate-x-3 shadow-[0_15px_35px_rgba(249,115,22,0.4)]" 
                    : track.id === currentTrackId 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "bg-zinc-900/10 border-transparent text-zinc-500 hover:bg-zinc-900/30"
                )}
              >
                <div className="flex items-center gap-6 overflow-hidden flex-1">
                  <span className={cn(
                    "text-xs font-mono font-black shrink-0 transition-colors",
                    focusedIndex === idx ? "text-black/40" : "text-primary/20"
                  )}>
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xl font-black uppercase tracking-tighter leading-none truncate drop-shadow-sm">
                    {track.title}
                  </span>
                </div>
                
                <div className="flex items-center gap-6 ml-4">
                  {track.id === currentTrackId && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/20 rounded-full">
                      <div className="flex gap-0.5 items-end h-3">
                        <div className="w-1 bg-current animate-[bounce_0.6s_infinite_0.1s]"></div>
                        <div className="w-1 bg-current animate-[bounce_0.6s_infinite_0.3s]"></div>
                        <div className="w-1 bg-current animate-[bounce_0.6s_infinite_0.5s]"></div>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-widest">TOCANDO</span>
                    </div>
                  )}
                  <span className={cn(
                    "text-[10px] font-mono font-bold shrink-0 opacity-40",
                    focusedIndex === idx ? "text-black" : ""
                  )}>
                    {track.duration}
                  </span>
                </div>
                
                {/* Decoration for focused state */}
                {focusedIndex === idx && (
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white opacity-40"></div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
