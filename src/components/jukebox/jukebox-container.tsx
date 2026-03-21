
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Album, ALBUMS, Track, QueuedTrack } from '@/lib/jukebox-data';
import { AlbumCard } from './album-card';
import { AlbumDetail } from './album-detail';
import { JukeboxFrame } from './jukebox-frame';
import { AdminMenu } from './admin-menu';
import { PaymentModal } from './payment-modal';
import { ListMusic, Video as VideoIcon, Search, RefreshCw, FolderSync, Smartphone, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJukebox } from '@/hooks/use-jukebox';
import { useKeyboardNavigation } from '@/hooks/use-keyboard-navigation';
import { saveAlbumsBulk, deleteAlbumFromDB } from '@/lib/db';
import { Button } from '@/components/ui/button';

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ITEMS_PER_PAGE = 8;
const COLUMNS = 4;

export const JukeboxContainer: React.FC = () => {
  const jukebox = useJukebox();
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [lastActivity, setLastActivity] = useState<number>(0);
  
  // Alphabet Search States
  const [showAlphabetBar, setShowAlphabetBar] = useState(false);
  const [alphabetIndex, setAlphabetIndex] = useState(0);
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visualizerRef = useRef<HTMLVideoElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Filtered Albums & Current Selection
  const allFilteredAlbums = React.useMemo(() => {
    let combined = [...jukebox.customAlbums, ...ALBUMS]
      .filter(album => !jukebox.hiddenGenres.includes(album.genre))
      .filter(album => !letterFilter || album.title.toUpperCase().startsWith(letterFilter));

    combined.sort((a, b) => {
      const aIsRelease = a.title.toUpperCase().startsWith('LANÇAMENTO') || a.genre === 'Novidades';
      const bIsRelease = b.title.toUpperCase().startsWith('LANÇAMENTO') || b.genre === 'Novidades';
      
      if (aIsRelease && !bIsRelease) return -1;
      if (!aIsRelease && bIsRelease) return 1;
      
      return a.title.localeCompare(b.title);
    });

    return combined;
  }, [jukebox.customAlbums, jukebox.hiddenGenres, letterFilter]);

  const selectedAlbum = React.useMemo(() => {
    return allFilteredAlbums.find(a => a.id === selectedAlbumId) || null;
  }, [allFilteredAlbums, selectedAlbumId]);

  const totalFiltered = allFilteredAlbums.length;

  useEffect(() => {
    setIsMounted(true);
    setLastActivity(Date.now());
  }, []);

  // Efeito para manter o álbum selecionado visível (Rolagem para todos os lados)
  useEffect(() => {
    const selectedEl = document.getElementById(`album-card-${selectedIndex}`);
    if (selectedEl && scrollContainerRef.current) {
      selectedEl.scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: 'center'
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const handleGlobalActivity = () => {
      setLastActivity(Date.now());
      if (isVideoMode && !jukebox.currentTrack) setIsVideoMode(false);
    };
    window.addEventListener('keydown', handleGlobalActivity, { capture: true });
    window.addEventListener('mousedown', handleGlobalActivity, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleGlobalActivity, { capture: true });
      window.removeEventListener('mousedown', handleGlobalActivity, { capture: true });
    };
  }, [isVideoMode, jukebox.currentTrack]);

  // Gestão de Reprodução Automática
  useEffect(() => {
    if (!jukebox.currentTrack && jukebox.queue.length > 0) {
      const next = jukebox.playNext();
      if (next && next.type === 'video') {
        setIsVideoMode(true);
        setSelectedAlbumId(null);
      } else {
        setIsVideoMode(false);
      }
    }
  }, [jukebox.currentTrack, jukebox.queue, jukebox.playNext]);

  // Modo Descanso (Vídeo Automático)
  useEffect(() => {
    if (jukebox.currentTrack && jukebox.currentTrack.type === 'audio' && !isVideoMode && !selectedAlbum && !showAdmin && !showAlphabetBar) {
      const interval = setInterval(() => {
        if (Date.now() - lastActivity >= 10000) {
          setIsVideoMode(true);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [jukebox.currentTrack, isVideoMode, selectedAlbum, showAdmin, lastActivity, showAlphabetBar]);

  // Playback Logic
  useEffect(() => {
    const videoElement = videoRef.current;
    const visualizerElement = visualizerRef.current;

    if (jukebox.currentTrack && videoElement) {
      const startPlayback = async () => {
        try {
          if (jukebox.activeMediaUrlRef.current) {
            URL.revokeObjectURL(jukebox.activeMediaUrlRef.current);
            jukebox.activeMediaUrlRef.current = null;
          }

          if (jukebox.currentTrack?.file) {
            const trackUrl = URL.createObjectURL(jukebox.currentTrack.file);
            jukebox.activeMediaUrlRef.current = trackUrl;
            videoElement.src = trackUrl;
            videoElement.load();
            videoElement.play().catch(() => jukebox.setCurrentTrack(null));

            if (jukebox.currentTrack.type === 'audio' && visualizerElement) {
              const vizUrl = await jukebox.getVisualizerUrl();
              visualizerElement.src = vizUrl;
              visualizerElement.load();
              visualizerElement.play().catch(() => {});
            }
          } else {
            jukebox.setMessage("MIDIA INDISPONIVEL");
            setTimeout(() => jukebox.setMessage(""), 2000);
            jukebox.setCurrentTrack(null);
          }
        } catch (e) {
          console.error("Erro ao processar mídia:", e);
          jukebox.setCurrentTrack(null);
        }
      };
      startPlayback();
    }
  }, [jukebox.currentTrack, jukebox.getVisualizerUrl]);

  // Logic below...

  // Keyboard Navigation Hook
  useKeyboardNavigation({
    onVolumeChange: (delta) => {
      setVolume(v => {
        const next = Math.max(0, Math.min(1, v + delta));
        jukebox.setMessage(`VOLUME: ${Math.round(next * 100)}%`);
        setTimeout(() => jukebox.setMessage(""), 1000);
        return next;
      });
    },
    onAdminToggle: () => setShowAdmin(p => !p),
    onAddCredit: () => jukebox.addCredit(),
    onNavigate: (key) => {
      let nextIndex = selectedIndex;
      if (key === 'ArrowLeft') {
        if (selectedIndex > 0) nextIndex = selectedIndex - 1;
      } else if (key === 'ArrowRight') {
        if (selectedIndex < totalFiltered - 1) nextIndex = selectedIndex + 1;
      } else if (key === 'ArrowUp') {
        if (selectedIndex >= COLUMNS) nextIndex = selectedIndex - COLUMNS;
      } else if (key === 'ArrowDown') {
        if (selectedIndex + COLUMNS < totalFiltered) nextIndex = selectedIndex + COLUMNS;
      }
      setSelectedIndex(nextIndex);
    },
    onBack: () => {
      if (selectedAlbumId) setSelectedAlbumId(null);
      else if (letterFilter) {
        setLetterFilter(null);
        setSelectedIndex(0);
      }
    },
    onSelect: () => {
      if (allFilteredAlbums[selectedIndex]) setSelectedAlbumId(allFilteredAlbums[selectedIndex].id);
    },
    isVideoMode,
    showAdmin,
    selectedAlbumId: selectedAlbumId,
    showAlphabetBar,
    onToggleAlphabetBar: setShowAlphabetBar,
    onAlphabetNavigate: (key) => {
      if (key === 'ArrowLeft') setAlphabetIndex(prev => (prev > 0 ? prev - 1 : ALPHABET.length - 1));
      else if (key === 'ArrowRight') setAlphabetIndex(prev => (prev < ALPHABET.length - 1 ? prev + 1 : 0));
    },
    onAlphabetSelect: () => {
      setLetterFilter(ALPHABET[alphabetIndex]);
      setShowAlphabetBar(false);
      setSelectedIndex(0);
    },
    onEscVideoMode: () => {
      setIsVideoMode(false);
      setLastActivity(Date.now());
    },
    onPaymentToggle: () => {
      if (!showAdmin) setShowPaymentModal(p => !p);
    }

  });

  if (!isMounted) return <div className="h-full w-full bg-black" />;

  return (
    <JukeboxFrame 
      credits={jukebox.credits} 
      statusMessage={jukebox.message} 
      currentTrack={jukebox.currentTrack}
      machineName={jukebox.machineName}
    >
      <div className="h-full w-full relative bg-black overflow-hidden" suppressHydrationWarning>
        


          {/* Banner de Re-autorização USB */}
        {jukebox.usbHandle && !jukebox.isUsbAuthorized && !showAdmin && (
          <div className="absolute top-0 inset-x-0 h-16 bg-primary/20 backdrop-blur-md z-[160] flex items-center justify-between px-10 border-b border-primary/30 animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-4">
              <RefreshCw className="h-6 w-6 text-primary animate-spin-slow" />
              <div>
                <p className="text-white font-black uppercase text-xs">USB Detectado</p>
                <p className="text-primary/60 text-[10px] uppercase font-bold tracking-widest">Acesso direto precisa ser reativado</p>
              </div>
            </div>
            <Button 
              onClick={jukebox.requestUsbPermission}
              className="bg-primary hover:bg-white text-black font-black uppercase text-xs px-6 py-2 rounded-sm transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)]"
            >
              Reativar Acesso
            </Button>
          </div>
        )}
        
        {/* Barra de Alfabeto Overlay */}
        {showAlphabetBar && (
          <div className="absolute top-0 inset-x-0 h-24 glass-morphism z-[150] flex flex-col items-center justify-center animate-in slide-in-from-top duration-300">
            <p className="text-primary/40 font-black uppercase text-[10px] tracking-[0.5em] mb-3">Busca por Letra</p>
            <div className="flex gap-3 overflow-hidden px-10">
              {ALPHABET.map((letter, i) => (
                <div 
                  key={letter}
                  className={cn(
                    "w-12 h-12 flex items-center justify-center font-black text-2xl transition-all rounded-sm",
                    alphabetIndex === i 
                      ? "bg-primary text-black scale-125 shadow-2xl" 
                      : "text-white/20"
                  )}
                >
                  {letter}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Indicador de Filtro Ativo */}
        {letterFilter && !showAlphabetBar && !selectedAlbum && (
          <div className="absolute top-6 left-6 z-[100] flex items-center gap-3 bg-primary text-black px-5 py-2 rounded-sm font-black uppercase text-sm animate-in fade-in slide-in-from-left">
            <Search className="h-4 w-4" />
            <span>Filtro: {letterFilter}</span>
            <span className="ml-3 text-[10px] opacity-60">[ESC] para Limpar</span>
          </div>
        )}

        {/* Visualizers and Video Players */}
        <video ref={visualizerRef} loop muted playsInline className={cn("absolute inset-0 w-full h-full bg-black z-0 transition-opacity duration-1000 object-cover", isVideoMode && jukebox.currentTrack?.type === 'audio' ? "opacity-100" : "opacity-0")} />
        <video ref={videoRef} onEnded={() => { jukebox.setCurrentTrack(null); setIsVideoMode(false); }} className={cn("absolute inset-0 w-full h-full bg-black z-10 transition-opacity duration-1000 object-contain", isVideoMode && jukebox.currentTrack?.type === 'video' ? "opacity-100" : "opacity-0")} preload="auto" playsInline />

        {/* Main Interface Content */}
        <div className={cn("relative h-full w-full z-20 transition-opacity duration-500", isVideoMode ? "opacity-0 pointer-events-none" : "opacity-100")} suppressHydrationWarning>
          {selectedAlbum ? (
            <AlbumDetail album={selectedAlbum} onBack={() => setSelectedAlbumId(null)} onSelectTrack={(track) => jukebox.addToQueue(track, selectedAlbum)} currentTrackId={jukebox.currentTrack?.id} />
          ) : (
            <div 
              ref={scrollContainerRef}
              className="h-full w-full bg-black overflow-y-auto overflow-x-hidden relative scrollbar-hide p-6" 
              suppressHydrationWarning
            >
              {totalFiltered === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-10 animate-pulse">
                  <Search className="h-24 w-24 text-zinc-900" />
                  <p className="text-zinc-800 text-6xl font-black uppercase tracking-[0.5em] text-center">SEM RESULTADOS</p>
                  <p className="text-primary/60 text-2xl font-black uppercase tracking-widest text-center">{letterFilter ? `Nenhuma letra "${letterFilter}"` : "Pressione [M] para configurar"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-6 pb-32" suppressHydrationWarning>
                  {allFilteredAlbums.map((album: Album, idx: number) => (
                    <div key={album.id || idx} id={`album-card-${idx}`} className="transition-all duration-300">
                      <AlbumCard album={album} isSelected={selectedIndex === idx} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Queue Sidebar */}
        {jukebox.queue.length > 0 && !selectedAlbum && !showAdmin && !isVideoMode && !showAlphabetBar && (
          <div className="absolute bottom-6 right-6 w-80 glass-morphism border border-white/10 p-6 animate-in slide-in-from-right-10 duration-500 z-[100] rounded-sm">
            <div className="flex items-center gap-3 mb-5 text-primary border-b border-white/5 pb-3">
              <ListMusic className="h-5 w-5" />
              <h3 className="font-black uppercase tracking-[0.3em] text-[11px] text-white">Fila de Espera</h3>
            </div>
            <div className="space-y-3 max-h-48 overflow-hidden">
              {jukebox.queue.slice(0, 4).map((t, i) => (
                <div key={`${t.id}-${i}`} className="border-l-[3px] border-primary/40 pl-4 py-2 flex items-center gap-3 bg-white/5 group hover:bg-white/10 transition-colors">
                  <div className="flex-1 overflow-hidden">
                    <p className="text-white font-black uppercase text-[11px] truncate leading-tight group-hover:text-primary transition-colors">{t.title}</p>
                    <p className="text-zinc-500 font-bold uppercase text-[9px] tracking-widest truncate">{t.artist}</p>
                  </div>
                  {t.type === 'video' && <VideoIcon className="h-3 w-3 text-primary/40" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAdmin && (
        <AdminMenu 
          onClose={() => setShowAdmin(false)} 
          onAddAlbumsBulk={async (newAlbums) => {
            try {
              await saveAlbumsBulk(newAlbums);
              const newIds = newAlbums.map(a => a.id);
              await jukebox.loadData(newIds);
              jukebox.setMessage("SINC. CONCLUÍDA!");
            } catch (e) {
              jukebox.setMessage("ERRO NA SINCRONIZACAO");
            }
            setTimeout(() => jukebox.setMessage(""), 3000);
          }}
          onDeleteAlbum={async (id) => {
            try {
              await deleteAlbumFromDB(id);
              await jukebox.loadData();
              jukebox.setMessage("ITEM REMOVIDO");
            } catch (e) {
              jukebox.setMessage("ERRO AO EXCLUIR");
            }
            setTimeout(() => jukebox.setMessage(""), 2000);
          }}
          albums={jukebox.customAlbums}
          pricePerSong={jukebox.pricePerSong}
          setPricePerSong={jukebox.setPricePerSong}
          revenueCash={jukebox.revenueCash}
          revenuePix={jukebox.revenuePix}
          hiddenGenres={jukebox.hiddenGenres}

          setHiddenGenres={jukebox.setHiddenGenres}
          visualizerCount={jukebox.customVisualizers.length}
          onVisualizersUpdated={jukebox.loadData}
          mpAccessToken={jukebox.mpAccessToken}
          setMpAccessToken={jukebox.setMpAccessToken}
          machineId={jukebox.machineId}
          setMachineId={jukebox.setMachineId}
        />
      )}

      {showPaymentModal && (
        <PaymentModal 
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(paidAmount: number) => {

            // Adiciona os créditos baseados no valor pago
            // Como temos uma tabela no modal, passamos o valor total
            // Mas para simplificar, podemos apenas adicionar proporcionalmente
            const extraCredits = paidAmount / jukebox.pricePerSong;
            jukebox.setCredits(prev => prev + extraCredits);
            jukebox.addPixRevenue(paidAmount);
            jukebox.setMessage("PIX RECEBIDO!");

            setTimeout(() => jukebox.setMessage(""), 3000);
          }}
          machineId={jukebox.machineId}
          mpAccessToken={jukebox.mpAccessToken}
        />
      )}
    </JukeboxFrame>
  );
};
