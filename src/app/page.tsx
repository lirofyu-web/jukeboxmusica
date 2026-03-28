"use client";

import React, { useEffect, useState } from 'react';
import { JukeboxContainer } from '@/components/jukebox/jukebox-container';
import { Loader2, X } from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [checkingHardLock, setCheckingHardLock] = useState(true);

  useEffect(() => {
    const checkKey = async () => {
      if (typeof window !== 'undefined' && (window as any).jukeboxAPI) {
        try {
          await (window as any).jukeboxAPI.checkHardLock();
          // Note: status check moved to JukeboxContainer/Provider
        } catch (e) {}
      }
      setCheckingHardLock(false);
      setLoading(false);
    };

    checkKey();
    const interval = setInterval(checkKey, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading || checkingHardLock) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">Inicializando Sistema...</p>
      </div>
    );
  }

  // Determina se estamos no App Nativo (Totem) ou no Navegador
  const isElectron = typeof window !== 'undefined' && !!(window as any).jukeboxAPI;

  // Bloqueio de Navegador: A Jukebox só funciona no ambiente nativo (Totem)
  if (!isElectron) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-10 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-white text-2xl font-black uppercase tracking-tighter">Ambiente Incompatível</h1>
          <p className="text-zinc-500 text-sm font-bold leading-relaxed">
            Esta interface foi desativada para navegadores. Use o aplicativo nativo Jukebox (Linux) para operar este equipamento.
          </p>
          <div className="pt-4">
             <p className="text-[10px] text-zinc-700 font-mono uppercase tracking-widest">Erro: JukeboxAPI_Undefined</p>
          </div>
        </div>
      </div>
    );
  }

  // Se estiver no Totem (Electron):
  // 1. Se NÃO tiver Hard Lock e NÃO tiver operador, 
  // o JukeboxContainer será exibido mas ele próprio mostrará a Splash de Bloqueio.
  // 2. Se TIVER Hard Lock, o JukeboxContainer abre normalmente.
  
  return (
    <main className="h-screen w-screen bg-black overflow-hidden">
      <JukeboxContainer />
    </main>
  );
}

