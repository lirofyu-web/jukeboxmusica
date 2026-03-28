
import React from 'react';
import { Album } from '@/lib/jukebox-data';
import { cn } from '../../lib/utils';
import Image from 'next/image';

interface AlbumCardProps {
  album: Album;
  isSelected: boolean;
}

const FALLBACK_COVER = "https://picsum.photos/seed/music/800/800";

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, isSelected }) => {
  const imageUrl = album.coverUrl || FALLBACK_COVER;

  return (
    <div 
      className={cn(
        "relative h-full w-full transition-all duration-500 border-[1px] overflow-hidden group flex flex-col bg-zinc-950",
        isSelected 
          ? "album-selected border-primary/50 shadow-[0_0_80px_rgba(249,115,22,0.4)]" 
          : "border-white/5 z-10 opacity-30 grayscale hover:opacity-60 hover:grayscale-0 transition-all duration-700"
      )}
    >
      <div className="relative flex-1 w-full overflow-hidden">
        <img 
          src={imageUrl} 
          alt={album.title}
          loading="lazy"
          decoding="async"
          className={cn(
            "w-full h-full object-cover transition-transform duration-1000",
            isSelected ? "scale-110" : "scale-100"
          )}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (img.src !== FALLBACK_COVER) {
              img.src = FALLBACK_COVER;
            }
          }}
        />
        
        {/* Vinyl Reflection Effect */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent skew-x-[-20deg] translate-x-[-150%] transition-transform duration-1000",
          isSelected ? "translate-x-[150%] animate-in" : ""
        )} />

        {/* Selected Pulse Border */}
        {isSelected && (
          <div className="absolute inset-0 ring-4 ring-primary/20 animate-pulse pointer-events-none" />
        )}
      </div>
      
      {/* Premium Footer */}
      <div className={cn(
        "w-auto mx-2 mb-2 mt-[-40px] z-50 bg-black/80 backdrop-blur-md py-3 px-4 transition-all duration-500 border border-white/10 rounded-sm shadow-2xl",
        isSelected ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <h3 className="gold-gradient-text text-[11px] font-black uppercase tracking-tight leading-none truncate mb-1">
          {album.title}
        </h3>
        <p className="text-zinc-500 text-[8px] font-black uppercase tracking-[0.3em] truncate opacity-70">
          {album.artist}
        </p>
      </div>
      
      {/* Corner Accent */}
      {isSelected && (
        <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[141%] h-[141%] bg-primary rotate-45 translate-x-[50%] translate-y-[-50%] opacity-20" />
        </div>
      )}
    </div>
  );
};
