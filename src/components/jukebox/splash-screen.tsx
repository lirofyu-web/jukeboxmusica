"use client";

import React, { useEffect, useState } from 'react';
import { Music2, Disc, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SplashScreenProps {
  isLocked?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isLocked = false }) => {
  const [phase, setPhase] = useState<'intro' | 'loading' | 'ready'>('intro');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (isLocked) {
      setPhase('intro');
      setIsVisible(true);
      return;
    }

    const timer1 = setTimeout(() => setPhase('loading'), 1200);
    const timer2 = setTimeout(() => setPhase('ready'), 3500);
    const timer3 = setTimeout(() => setIsVisible(false), 4500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isLocked]);

  if (!isVisible && !isLocked) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-[#050505] transition-all duration-1000",
      phase === 'ready' ? "opacity-0 scale-110 pointer-events-none" : "opacity-100"
    )}>
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Main Content */}
      <div className="relative flex flex-col items-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
          <div className="relative w-32 h-32 bg-black border-2 border-primary/30 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.2)]">
            <Music2 className={cn(
              "h-16 w-16 text-primary transition-all duration-700",
              phase === 'intro' ? "scale-50 opacity-0" : "scale-100 opacity-100 rotate-[360deg]"
            )} />
            <div className="absolute -top-2 -right-2">
              <Star className={cn(
                "h-6 w-6 text-yellow-500 animate-spin-slow transition-opacity duration-1000",
                phase === 'ready' ? "opacity-100" : "opacity-0"
              )} />
            </div>
          </div>
          
          <Disc className={cn(
            "absolute -bottom-4 -left-4 h-12 w-12 text-primary/40 animate-spin-slow transition-opacity duration-700",
            phase === 'intro' ? "opacity-0" : "opacity-100"
          )} />
        </div>

        <div className="text-center space-y-2">
          <h1 className={cn(
            "text-6xl font-black text-white uppercase tracking-tighter leading-none transition-all duration-1000",
            phase === 'intro' ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
          )}>
            Jukebox <span className="text-primary">Music</span>
          </h1>
          <p className={cn(
            "text-[10px] uppercase font-bold tracking-[0.6em] text-zinc-500 transition-all duration-1000 delay-300",
            phase === 'intro' ? "opacity-0" : "opacity-100"
          )}>
            Premium Entertainment System
          </p>
        </div>

        {/* Loading Bar */}
        <div className={cn(
          "mt-12 w-64 h-1 bg-white/5 rounded-full overflow-hidden transition-all duration-700",
          phase === 'intro' ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"
        )}>
          <div className={cn(
            "h-full bg-primary transition-all duration-[2300ms] ease-out",
            phase === 'loading' ? "w-full" : "w-0"
          )} />
        </div>

        <div className={cn(
          "mt-4 text-[9px] uppercase font-black text-primary/40 tracking-widest transition-opacity duration-500",
          (phase === 'loading' || isLocked) ? "opacity-100 animate-pulse" : "opacity-0"
        )}>
          {isLocked ? (
            <span className="text-red-500 bg-red-500/10 px-4 py-1 rounded-sm border border-red-500/20">
              AGUARDANDO CHAVE USB (HARD LOCK)
            </span>
          ) : (
            phase === 'loading' ? 'Iniciando Hardware...' : 'Sistema Pronto'
          )}
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-10 left-0 right-0 text-center">
        <p className="text-[8px] text-white/10 uppercase tracking-[0.2em] font-bold">
          &copy; 2026 Powered by Antigravity OS
        </p>
      </div>

      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};
