"use client";

import React from 'react';
import { QueuedTrack } from '@/lib/jukebox-data';
import { Music, Video } from 'lucide-react';
import { cn } from '../../lib/utils';

interface JukeboxFrameProps {
  children: React.ReactNode;
  credits: number;
  statusMessage?: string;
  currentTrack?: QueuedTrack | null;
  machineName?: string;
  isLinked?: boolean;
}

export const JukeboxFrame: React.FC<JukeboxFrameProps> = ({ children, credits, statusMessage, currentTrack, machineName, isLinked }) => {
  const [hasInternet, setHasInternet] = React.useState(true);

  React.useEffect(() => {
    setHasInternet(navigator.onLine);
    const handleOnline = () => setHasInternet(true);
    const handleOffline = () => setHasInternet(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden selection:bg-primary/30 font-sans" suppressHydrationWarning>
      {/* Main Display Area */}
      <div className="flex-1 relative overflow-hidden bg-black" suppressHydrationWarning>
        {/* Subtle Scanline Overlay for CRT feel */}
        <div className="absolute inset-0 pointer-events-none z-[200] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
        
        {/* Offline/Online Badge */}
        <div className={cn(
          "absolute top-6 right-6 z-[250] flex items-center gap-2 px-3 py-1 rounded-sm border transition-all duration-500 backdrop-blur-md font-black uppercase tracking-[0.2em] text-[9px]",
          isLinked 
            ? "bg-green-500/10 border-green-500/20 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.1)]" 
            : "bg-red-500/20 border-red-500/40 text-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.3)]"
        )}>
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            isLinked ? (hasInternet ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]") : "bg-red-500 animate-ping"
          )} />
          <span>
            {isLinked ? "SISTEMA ONLINE" : "SISTEMA OFFLINE"}
          </span>
        </div>

        {children}
        
        {/* Status Message Overlay */}
        {statusMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[300] animate-in zoom-in duration-300 pointer-events-none">
            <div className="premium-gradient text-white px-10 py-4 rounded-sm font-black text-2xl uppercase shadow-[0_0_60px_rgba(249,115,22,0.8)] border-2 border-white/20">
              {statusMessage}
            </div>
          </div>
        )}
      </div>
      
      {/* Footer with Glassmorphism */}
      <div className="h-28 glass-morphism grid grid-cols-3 items-center px-10 z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.95)]" suppressHydrationWarning>
        
        {/* Lado Esquerdo: Identificação */}
        <div className="flex items-center gap-4" suppressHydrationWarning>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-orange-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-zinc-900 px-4 py-1.5 rounded-full border border-white/5">
              <p className="gold-gradient-text text-[10px] font-black uppercase tracking-[0.5em]">{machineName || "JUKEBOX"}</p>
            </div>
          </div>
        </div>

        {/* Meio: Display de Créditos Centralizado com Glow */}
        <div className="flex flex-col items-center justify-center scale-110" suppressHydrationWarning>
          <div className="relative group">
            <div className="absolute -inset-4 bg-yellow-500/10 rounded-xl blur-2xl group-hover:bg-yellow-500/20 transition-all duration-500"></div>
            <div className="relative flex items-center gap-6 bg-black/60 px-10 py-3 border border-yellow-500/30 rounded-xl backdrop-blur-md shadow-2xl">
              <div className="flex flex-col items-start leading-none">
                <span className="text-yellow-500/40 text-[9px] font-black uppercase tracking-[0.3em] mb-1">SALDO</span>
                <span className="text-yellow-500/60 text-[12px] font-black uppercase font-mono tracking-tighter">R$</span>
              </div>
              <p className="text-yellow-400 text-5xl uppercase tracking-tighter font-black drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] font-mono leading-none animate-pulse-gold">
                {credits.toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
        </div>

        {/* Lado Direito: Info da Música/Vídeo Atual */}
        <div className="flex justify-end overflow-hidden" suppressHydrationWarning>
          {currentTrack && (
            <div className="flex items-center gap-5 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  <p className="text-primary font-black uppercase text-[8px] tracking-[0.4em]">
                    {currentTrack.type === 'video' ? 'VÍDEO REPRODUZINDO' : 'TOCANDO AGORA'}
                  </p>
                </div>
                <h4 className="text-xl font-black text-white uppercase tracking-tighter truncate leading-tight max-w-[250px] drop-shadow-md">
                  {currentTrack.title}
                </h4>
                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-[0.2em] truncate max-w-[200px]">
                  {currentTrack.artist}
                </p>
              </div>
              
              <div className="relative shrink-0">
                <div className="absolute -inset-2 bg-primary/20 rounded-full blur-md animate-pulse"></div>
                <div className="h-16 w-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-full flex items-center justify-center border-2 border-white/10 shrink-0 shadow-xl relative">
                  {currentTrack.type === 'video' ? (
                    <Video className="h-7 w-7 text-primary" />
                  ) : (
                    <Music className="h-7 w-7 text-primary" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
