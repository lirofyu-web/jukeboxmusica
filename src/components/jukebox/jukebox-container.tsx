
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Album, ALBUMS, Track, QueuedTrack } from '@/lib/jukebox-data';
import { AlbumCard } from './album-card';
import { AlbumDetail } from './album-detail';
import { JukeboxFrame } from './jukebox-frame';
import { AdminMenu } from './admin-menu';
import { PaymentModal } from './payment-modal';
import { VolumeBar } from './volume-bar';
import { SplashScreen } from './splash-screen';
import { ListMusic, Video as VideoIcon, Search, RefreshCw, FolderSync, Smartphone, CreditCard } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useJukebox } from '@/hooks/use-jukebox';
import { useKeyboardNavigation } from '@/hooks/use-keyboard-navigation';
import { useAuth } from '@/firebase/provider';
import { saveAlbumsBulk, deleteAlbumFromDB, getSettings } from '@/lib/db';
import { Button } from '@/components/ui/button';

const ALPHABET = ["*", ...("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""))];
const ITEMS_PER_PAGE = 8;
const COLUMNS = 4;

export const JukeboxContainer: React.FC = () => {
  const jukebox = useJukebox();
  const auth = useAuth();
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [showVolumeBar, setShowVolumeBar] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(0);
  const volumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const alphabetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard Mappings
  const [keyMappings, setKeyMappings] = useState<Record<string, string>>({
    KEY_MENU: 'm',
    KEY_CREDIT: 'c',
    KEY_UP: 'arrowup',
    KEY_DOWN: 'arrowdown',
    KEY_LEFT: 'arrowleft',
    KEY_RIGHT: 'arrowright',
    KEY_SELECT: 'enter',
    KEY_CHOOSE_ALBUM: '1',
    KEY_PLAY_TRACK: '2',
    KEY_BACK: 'backspace',
    KEY_VOL_CONTROL: 'v',
    KEY_VOL_UP: '+',
    KEY_VOL_DOWN: '-',
    KEY_PIX: 'p',
    KEY_ALPHABET: 'a'
  });


  const loadMappings = useCallback(async () => {
    const saved = await getSettings<Record<string, string>>('keyMappings');
    if (saved) setKeyMappings(prev => ({ ...prev, ...saved }));
  }, []);

  useEffect(() => {
    loadMappings();
    window.addEventListener('jukebox-reload-settings', loadMappings);
    return () => window.removeEventListener('jukebox-reload-settings', loadMappings);
  }, [loadMappings]);

  const handleLogout = useCallback(async () => {
    if (auth) {
      await auth.signOut();
      setShowAdmin(false);
    }
  }, [auth]);
  
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
      .filter(album => !jukebox.hiddenGenres.includes(album.genre));

    if (letterFilter === '*') {
      // Filtro especial para lançamentos
      combined = combined.filter(album => 
        album.title.toUpperCase().startsWith('LANÇAMENTO') || 
        album.genre === 'Novidades' ||
        album.genre === 'Lançamentos'
      );
    } else if (letterFilter) {
      const byLetter = combined.filter(album => album.title.toUpperCase().startsWith(letterFilter));
      if (byLetter.length > 0) {
        combined = byLetter;
      } else {
        // Fallback para lançamentos se não encontrar nada com a letra
        combined = combined.filter(album => 
          album.title.toUpperCase().startsWith('LANÇAMENTO') || 
          album.genre === 'Novidades' ||
          album.genre === 'Lançamentos'
        );
      }
    }

    combined.sort((a, b) => {
      const aIsRelease = a.title.toUpperCase().startsWith('LANÇAMENTO') || a.genre === 'Novidades' || a.genre === 'Lançamentos';
      const bIsRelease = b.title.toUpperCase().startsWith('LANÇAMENTO') || b.genre === 'Novidades' || b.genre === 'Lançamentos';
      
      if (aIsRelease && !bIsRelease) return -1;
      if (!aIsRelease && bIsRelease) return 1;
      
      return a.title.localeCompare(b.title);
    });

    return combined;
  }, [jukebox.customAlbums, jukebox.hiddenGenres, letterFilter]);

  const currentPage = Math.floor(selectedIndex / ITEMS_PER_PAGE);
  const paginatedAlbums = React.useMemo(() => {
    return allFilteredAlbums.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  }, [allFilteredAlbums, currentPage]);

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

  // Timer para fechar a barra alfabética por inatividade (10s)
  useEffect(() => {
    if (showAlphabetBar) {
      if (alphabetTimeoutRef.current) clearTimeout(alphabetTimeoutRef.current);
      alphabetTimeoutRef.current = setTimeout(() => {
        setShowAlphabetBar(false);
      }, 10000);
    } else {
      if (alphabetTimeoutRef.current) clearTimeout(alphabetTimeoutRef.current);
    }
    return () => {
      if (alphabetTimeoutRef.current) clearTimeout(alphabetTimeoutRef.current);
    };
  }, [showAlphabetBar, alphabetIndex]);

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

  // Abertura Automática via Pendrive de Atualização (Músicas)
  useEffect(() => {
    if (jukebox.isUpdateDiskPresent && !showAdmin) {
      setShowAdmin(true);
    }
  }, [jukebox.isUpdateDiskPresent, showAdmin]);

  // Keyboard Navigation Hook
  useKeyboardNavigation({
    onVolumeChange: (delta) => {
      setVolume(v => Math.max(0, Math.min(1, v + delta)));
      
      // Reinicia o timer de 10s da barra de volume ao mudar o valor
      if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
      volumeTimerRef.current = setTimeout(() => setShowVolumeBar(false), 10000);
    },
    onAdminToggle: () => {
      setShowAdmin(p => !p);
      setShowVolumeBar(false);
    },
    onAddCredit: () => jukebox.addCredit(),
    onToggleVolume: () => {
      setShowVolumeBar(prev => {
        const next = !prev;
        if (next) {
          if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
          volumeTimerRef.current = setTimeout(() => setShowVolumeBar(false), 10000);
        }
        return next;
      });
    },

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
    },
    showPaymentModal,
    showVolumeBar,
    mappings: keyMappings
  });


  if (!isMounted || !jukebox.machineId) return <div className="h-full w-full bg-black" />;

  // Se o sistema estiver bloqueado (Hard Lock USB), mostramos a Splash de Bloqueio
  // MAS permitimos que o AdminMenu (M) seja aberto sobre ela para configuração
  if (jukebox.isSystemLocked && !showAdmin) {
    return (
      <JukeboxFrame 
        credits={0} 
        statusMessage="SISTEMA BLOQUEADO" 
        currentTrack={null}
        machineName={jukebox.machineName}
      >
        <div className="h-full w-full relative bg-black overflow-hidden" suppressHydrationWarning>
          <SplashScreen isLocked={true} />
        </div>
      </JukeboxFrame>
    );
  }

  return (
    <JukeboxFrame 
      credits={jukebox.credits} 
      statusMessage={jukebox.message} 
      currentTrack={jukebox.currentTrack}
      machineName={jukebox.machineName}
      isLinked={jukebox.isLinked}
    >
      <div className="h-full w-full relative bg-black overflow-hidden" suppressHydrationWarning>
        <SplashScreen isLocked={jukebox.isSystemLocked} />
        

          {/* Banner de Re-autorização USB - Removido para inicialização transparente conforme pedido */}
        {/* jukebox.usbHandle && !jukebox.isUsbAuthorized && !showAdmin && ( ... ) */}
        
        {/* Barra de Alfabeto Overlay Centrada */}
        {showAlphabetBar && (
          <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center animate-in fade-in zoom-in duration-300">
            <div className="flex flex-wrap gap-2 justify-center max-w-4xl px-10">
              {ALPHABET.map((letter, i) => (
                <div 
                  key={letter}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center font-black text-lg transition-all rounded-sm",
                    alphabetIndex === i 
                      ? "bg-primary text-black scale-125 shadow-2xl ring-2 ring-primary/50" 
                      : "text-white/30 border border-white/5 bg-white/5"
                  )}
                >
                  {letter}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visualizers and Video Players */}
        <video ref={visualizerRef} loop muted playsInline className={cn("absolute inset-0 w-full h-full bg-black z-0 transition-opacity duration-1000 object-cover", isVideoMode && jukebox.currentTrack?.type === 'audio' ? "opacity-100" : "opacity-0")} />
        <video ref={videoRef} onEnded={() => { jukebox.setCurrentTrack(null); setIsVideoMode(false); }} className={cn("absolute inset-0 w-full h-full bg-black z-10 transition-opacity duration-1000 object-contain", isVideoMode && jukebox.currentTrack?.type === 'video' ? "opacity-100" : "opacity-0")} preload="auto" playsInline />

        {/* Main Interface Content */}
        <div className={cn("relative h-full w-full z-20 transition-opacity duration-500", isVideoMode ? "opacity-0 pointer-events-none" : "opacity-100")} suppressHydrationWarning>
          {selectedAlbum ? (
            <AlbumDetail 
              album={selectedAlbum} 
              onBack={() => setSelectedAlbumId(null)} 
              onSelectTrack={(track) => jukebox.addToQueue(track, selectedAlbum)} 
              currentTrackId={jukebox.currentTrack?.id} 
              showPaymentModal={showPaymentModal}
              showAdmin={showAdmin}
              playKey={keyMappings.KEY_PLAY_TRACK}
              upKey={keyMappings.KEY_UP}
              downKey={keyMappings.KEY_DOWN}
              backKey={keyMappings.KEY_BACK}
            />
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
                <div className="grid grid-cols-4 grid-rows-2 gap-4 h-[calc(100vh-160px)] pb-4 overflow-hidden" suppressHydrationWarning>
                  {paginatedAlbums.map((album: Album, idxInPage: number) => {
                    const globalIdx = currentPage * ITEMS_PER_PAGE + idxInPage;
                    return (
                      <div key={album.id || globalIdx} id={`album-card-${globalIdx}`} className="transition-all duration-300">
                        <AlbumCard album={album} isSelected={selectedIndex === globalIdx} />
                      </div>
                    );
                  })}
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
          onUpdatePrice={jukebox.updatePrice}
          revenueCash={jukebox.revenueCash}
          revenuePix={jukebox.revenuePix}
          partialRevenueCash={jukebox.partialRevenueCash}
          partialRevenuePix={jukebox.partialRevenuePix}
          lastResetDate={jukebox.lastResetDate}
          onResetPartial={jukebox.resetPartialRevenue}
          randomPlayEnabled={jukebox.randomPlayEnabled}
          randomPlayInterval={jukebox.randomPlayInterval}
          onUpdateRandomPlay={jukebox.updateRandomPlay}
          bonusConfig={jukebox.bonusConfig}
          onUpdateBonusConfig={jukebox.updateBonusConfig}
          hiddenGenres={jukebox.hiddenGenres}
          onUpdateHiddenGenres={jukebox.updateHiddenGenres}
          visualizerCount={jukebox.customVisualizers.length}
          onVisualizersUpdated={jukebox.loadData}
          mpAccessToken={jukebox.mpAccessToken}
          setMpAccessToken={jukebox.setMpAccessToken}
          machineId={jukebox.machineId}
          onLogout={handleLogout}
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
          mappings={keyMappings}
        />
      )}

      <VolumeBar volume={volume} isVisible={showVolumeBar} />
    </JukeboxFrame>
  );
};

