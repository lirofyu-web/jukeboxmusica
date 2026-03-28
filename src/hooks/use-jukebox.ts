"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Album, ALBUMS, Track, QueuedTrack, VisualizerVideo } from '@/lib/jukebox-data';
import { getAllAlbums, getAllVisualizers, getUSBHandle, clearUSBHandle } from '@/lib/db';
import { useFirestore, useAuth } from '@/firebase/provider';
import { useMachine } from '@/components/machine-provider';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

const DEFAULT_VISUALIZERS = [
  "https://assets.mixkit.co/videos/preview/mixkit-abstract-motion-background-with-pinks-and-purples-34443-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-abstract-lines-and-dots-in-blue-background-20822-large.mp4"
];

const FALLBACK_COVER = "https://picsum.photos/seed/music/800/800";

export const useJukebox = () => {
  const firestore = useFirestore();
  const auth = useAuth();
  const { machineId } = useMachine();
  const [operator, setOperator] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [customAlbums, setCustomAlbums] = useState<Album[]>([]);
  const [customVisualizers, setCustomVisualizers] = useState<VisualizerVideo[]>([]);
  const [currentTrack, setCurrentTrack] = useState<QueuedTrack | null>(null);
  const [queue, setQueue] = useState<QueuedTrack[]>([]);
  const [pricePerSong, setPricePerSong] = useState(0.50);
  const [revenueCash, setRevenueCash] = useState(0);
  const [revenuePix, setRevenuePix] = useState(0);
  const [partialRevenueCash, setPartialRevenueCash] = useState(0);
  const [partialRevenuePix, setPartialRevenuePix] = useState(0);
  const [lastResetDate, setLastResetDate] = useState<string>("");
  const [randomPlayEnabled, setRandomPlayEnabled] = useState(false);
  const [randomPlayInterval, setRandomPlayInterval] = useState(30); // minutes
  const [bonusConfig, setBonusConfig] = useState<Record<string, number>>({
    '5': 0, '10': 0, '20': 0, '50': 0
  });
  const [hiddenGenres, setHiddenGenres] = useState<string[]>([]);

  const [mpAccessToken, setMpAccessToken] = useState<string>("");
  const [machineName, setMachineName] = useState<string>("");
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [activeVisualizerUrl, setActiveVisualizerUrl] = useState<string>("");
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState<boolean>(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, u => setOperator(u));
  }, [auth]);

  useEffect(() => {
    if (!machineId || !firestore) return;
    const unsub = onSnapshot(doc(firestore, 'machines', machineId), (snap: any) => {
      if (snap.exists()) {
        const data = snap.data();
        setMachineName(data.name || "");
        if (data.pricePerSong !== undefined) setPricePerSong(data.pricePerSong);
        if (data.mpAccessToken !== undefined) setMpAccessToken(data.mpAccessToken);
        if (data.revenueCash !== undefined) setRevenueCash(data.revenueCash);
        if (data.revenuePix !== undefined) setRevenuePix(data.revenuePix);
        if (data.partialRevenueCash !== undefined) setPartialRevenueCash(data.partialRevenueCash);
        if (data.partialRevenuePix !== undefined) setPartialRevenuePix(data.partialRevenuePix);
        if (data.lastResetDate !== undefined) setLastResetDate(data.lastResetDate);
        if (data.randomPlayEnabled !== undefined) setRandomPlayEnabled(data.randomPlayEnabled);
        if (data.randomPlayInterval !== undefined) setRandomPlayInterval(data.randomPlayInterval);
        if (data.bonusConfig !== undefined) setBonusConfig(data.bonusConfig);
        if (data.hiddenGenres !== undefined) setHiddenGenres(data.hiddenGenres);
        setIsLinked(true);
      } else {
        setIsLinked(false);
      }
    });
    return () => unsub();
  }, [machineId, firestore]);

  const [usbHandle, setUsbHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isUsbAuthorized, setIsUsbAuthorized] = useState(false);

  const albumObjectUrlsRef = useRef<Map<string, string>>(new Map());
  const activeMediaUrlRef = useRef<string | null>(null);
  const activeVisualizerBlobUrlRef = useRef<string | null>(null);

  const isInitialLoadDoneRef = useRef(false);
  const [isUpdateDiskPresent, setIsUpdateDiskPresent] = useState(false);
  const [isSystemLocked, setIsSystemLocked] = useState(true);
  const lastUsbKeyStateRef = useRef(false);

  const loadData = useCallback(async (forceRefreshIds: string[] = []) => {
    try {
      const storedAlbums = await getAllAlbums();
      const newUrlsMap = new Map<string, string>();
      
      const albumsWithUrls = storedAlbums.map(album => {
        const existingUrl = albumObjectUrlsRef.current.get(album.id);
        if (existingUrl && !forceRefreshIds.includes(album.id)) {
          newUrlsMap.set(album.id, existingUrl);
          return { ...album, coverUrl: existingUrl };
        }

        const blob = album.coverBlob;
        if (blob instanceof Blob && blob.size > 0) {
          try {
            const url = URL.createObjectURL(blob);
            newUrlsMap.set(album.id, url);
            return { ...album, coverUrl: url };
          } catch (err) {
            console.error(`Erro ao criar URL para album "${album.title}":`, err);
          }
        }
        
        // Se não tem blob, mantém a URL que veio do banco (que pode ser a da sincronização)
        return album;
      });

      // Limpeza: revoga URLs de álbuns que foram excluídos ou ATUALIZADOS
      albumObjectUrlsRef.current.forEach((url, id) => {
        if (newUrlsMap.get(id) !== url) {
          URL.revokeObjectURL(url);
        }
      });

      albumObjectUrlsRef.current = newUrlsMap;
      setCustomAlbums(albumsWithUrls);
      
      console.log(`[Jukebox] Dados carregados: ${albumsWithUrls.length} álbuns (${albumsWithUrls.filter(a => a.coverBlob).length} com capa blob)`);
      
      const storedVisualizers = await getAllVisualizers();
      setCustomVisualizers(storedVisualizers);
      
      const handle = await getUSBHandle();
      if (handle) {
        setUsbHandle(handle);
        try {
          // Tenta verificar se já temos acesso sem disparar o picker
          const permission = await (handle as any).queryPermission({ mode: 'read' });
          setIsUsbAuthorized(permission === 'granted');
          
          if (permission === 'prompt') {
            console.log("[Jukebox] Acesso USB pendente de autorização.");
          }
        } catch (err) {
          console.error("Erro ao verificar permissão USB:", err);
        }
      }

      if (!isInitialLoadDoneRef.current) {
          const savedPrice = localStorage.getItem('jukebox_price');
          if (savedPrice) setPricePerSong(Number(savedPrice));
          
          const savedRevenueCash = localStorage.getItem('jukebox_revenue_cash');
          if (savedRevenueCash) {
            setRevenueCash(Number(savedRevenueCash));
          } else {
            const savedLegacyRevenue = localStorage.getItem('jukebox_revenue');
            if (savedLegacyRevenue) {
              setRevenueCash(Number(savedLegacyRevenue));
              localStorage.setItem('jukebox_revenue_cash', savedLegacyRevenue);
            }
          }


          const savedRevenuePix = localStorage.getItem('jukebox_revenue_pix');
          if (savedRevenuePix) setRevenuePix(Number(savedRevenuePix));

          const savedPartialCash = localStorage.getItem('jukebox_partial_cash');
          if (savedPartialCash) setPartialRevenueCash(Number(savedPartialCash));
          
          const savedPartialPix = localStorage.getItem('jukebox_partial_pix');
          if (savedPartialPix) setPartialRevenuePix(Number(savedPartialPix));

          const savedResetDate = localStorage.getItem('jukebox_last_reset');
          if (savedResetDate) setLastResetDate(savedResetDate);

          const savedHidden = localStorage.getItem('jukebox_hidden_genres');
          if (savedHidden) setHiddenGenres(JSON.parse(savedHidden));

          const savedRandomEnabled = localStorage.getItem('jukebox_random_enabled');
          if (savedRandomEnabled) setRandomPlayEnabled(savedRandomEnabled === 'true');

          const savedRandomInterval = localStorage.getItem('jukebox_random_interval');
          if (savedRandomInterval) setRandomPlayInterval(Number(savedRandomInterval));

          const savedBonus = localStorage.getItem('jukebox_bonus_config');
          if (savedBonus) setBonusConfig(JSON.parse(savedBonus));

          const savedCredits = localStorage.getItem('jukebox_credits');
          if (savedCredits) setCredits(Number(savedCredits));
          
          const savedMPToken = localStorage.getItem('jukebox_mp_token');
          if (savedMPToken) setMpAccessToken(savedMPToken);

          isInitialLoadDoneRef.current = true;
          setIsInitialLoadDone(true);
        }
      
    } catch (e) {
      console.error("Erro ao carregar banco de dados:", e);
      setIsInitialLoadDone(true);
      isInitialLoadDoneRef.current = true;
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleReload = () => loadData();
    window.addEventListener('jukebox-reload-data', handleReload);
    return () => window.removeEventListener('jukebox-reload-data', handleReload);
  }, [loadData]);

  // Limpeza apenas no unmount real do componente
  useEffect(() => {
    return () => {
      albumObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      if (activeMediaUrlRef.current) URL.revokeObjectURL(activeMediaUrlRef.current);
      if (activeVisualizerBlobUrlRef.current) URL.revokeObjectURL(activeVisualizerBlobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (isInitialLoadDone) {
      // Configurações agora são gerenciadas via Firestore (Admin Panel)
      // Apenas créditos e gêneros ocultos permanecem puramente locais por enquanto
      localStorage.setItem('jukebox_hidden_genres', JSON.stringify(hiddenGenres));
      localStorage.setItem('jukebox_credits', credits.toString());
      if (machineId) localStorage.setItem('jukebox_machine_id', machineId);
    }
  }, [hiddenGenres, credits, machineId, isInitialLoadDone]);

  // Polling para detectar Pendrive (Chave Física / Hard Lock)
  useEffect(() => {
    const checkUsbKey = async () => {
      // 1. PRIORIDADE: Se houver um operador logado (Painel Admin/Remoto), 
      // o sistema NUNCA deve bloquear, mesmo se não houver pendrive.
      if (operator) {
        if (isSystemLocked) setIsSystemLocked(false);
        return;
      }

      // 2. Fluxo Nativo (Electron / Totem Físico)
      if (typeof window !== 'undefined' && (window as any).jukeboxAPI) {
        try {
          const status = await (window as any).jukeboxAPI.checkHardLock();
          
          if (status.hardLockPresent) {
            if (isSystemLocked) setIsSystemLocked(false);
          } else {
            // No Totem, se tirar a chave e não tiver operador logado, BLOQUEIA.
            if (!isSystemLocked) setIsSystemLocked(true);
          }

          if (status.linkCode) {
            setLinkCode(status.linkCode);
          } else {
            setLinkCode(null);
          }

          if (status.updateDiskPresent) {
            if (!isUpdateDiskPresent) setIsUpdateDiskPresent(true);
          } else {
            if (isUpdateDiskPresent) setIsUpdateDiskPresent(false);
          }
          return;
        } catch (err) {
          console.error('Erro ao verificar Status USB Nativo:', err);
        }
      }

      // 3. Modo Web (Navegador sem API nativa)
      if (!isSystemLocked) setIsSystemLocked(true);
    };

    const interval = setInterval(checkUsbKey, 2000);
    checkUsbKey();
    return () => clearInterval(interval);
  }, [operator, isSystemLocked, isUpdateDiskPresent]);



  const pulseCountRef = useRef(0);
  const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const applyPulseBonus = useCallback((count: number) => {
    let bonus = 0;
    if (count >= 50) bonus = bonusConfig['50'] || 0;
    else if (count >= 20) bonus = bonusConfig['20'] || 0;
    else if (count >= 10) bonus = bonusConfig['10'] || 0;
    else if (count >= 5) bonus = bonusConfig['5'] || 0;

    if (bonus > 0) {
      setCredits(prev => {
        const newVal = prev + bonus;
        localStorage.setItem('jukebox_credits', newVal.toString());
        return newVal;
      });
      setMessage(`BÔNUS +${bonus}!`);
      setTimeout(() => setMessage(""), 3000);
    }
    pulseCountRef.current = 0;
  }, [bonusConfig]);

  const addCredit = useCallback(() => {
    // 1 pulso = R$ 1,00
    const pulseValue = 1.00;
    const creditsFromPulse = pulseValue / pricePerSong;

    setCredits(prev => {
      const newVal = prev + creditsFromPulse;
      localStorage.setItem('jukebox_credits', newVal.toString());
      return newVal;
    });
    
    setRevenueCash(prev => {
      const newCash = prev + pulseValue;
      setPartialRevenueCash(pPrev => {
        const newPartial = pPrev + pulseValue;
        if (machineId && firestore) {
          updateDoc(doc(firestore, 'machines', machineId), { 
            revenueCash: newCash,
            partialRevenueCash: newPartial
          }).catch(err => console.error("Erro ao sincronizar receita (Dinheiro):", err));
        }
        localStorage.setItem('jukebox_partial_cash', newPartial.toString());
        return newPartial;
      });
      return newCash;
    });

    setMessage("CRÉDITO OK!");
    setTimeout(() => setMessage(""), 1000);

    // Lógica de Pacote de Pulsos (Agrupar nota/moedas para bônus)
    pulseCountRef.current += 1;
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      applyPulseBonus(pulseCountRef.current);
    }, 1500);
  }, [machineId, firestore, pricePerSong, applyPulseBonus]);

  const addPixRevenue = useCallback((amount: number) => {
    // Cálculo de Bônus PIX
    let bonus = 0;
    if (amount >= 50) bonus = bonusConfig['50'] || 0;
    else if (amount >= 20) bonus = bonusConfig['20'] || 0;
    else if (amount >= 10) bonus = bonusConfig['10'] || 0;
    else if (amount >= 5) bonus = bonusConfig['5'] || 0;

    if (bonus > 0) {
      const extraCredits = bonus * pricePerSong;
      setCredits(prev => {
        const newVal = prev + extraCredits;
        localStorage.setItem('jukebox_credits', newVal.toString());
        return newVal;
      });
      setMessage(`BÔNUS PIX +${bonus}!`);
      setTimeout(() => setMessage(""), 3000);
    }

    setRevenuePix(prev => {
      const newPix = prev + amount;
      setPartialRevenuePix(pPrev => {
        const newPartial = pPrev + amount;
        if (machineId && firestore) {
          updateDoc(doc(firestore, 'machines', machineId), { 
            revenuePix: newPix,
            partialRevenuePix: newPartial
          }).catch(err => console.error("Erro ao sincronizar receita (PIX):", err));
        }
        localStorage.setItem('jukebox_partial_pix', newPartial.toString());
        return newPartial;
      });
      return newPix;
    });
  }, [machineId, firestore, bonusConfig, pricePerSong]);

  const resetPartialRevenue = useCallback(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    setPartialRevenueCash(0);
    setPartialRevenuePix(0);
    setLastResetDate(dateStr);

    localStorage.setItem('jukebox_partial_cash', '0');
    localStorage.setItem('jukebox_partial_pix', '0');
    localStorage.setItem('jukebox_last_reset', dateStr);

    if (machineId && firestore) {
      updateDoc(doc(firestore, 'machines', machineId), { 
        partialRevenueCash: 0,
        partialRevenuePix: 0,
        lastResetDate: dateStr
      }).catch(err => console.error("Erro ao resetar receita parcial:", err));
    }
  }, [machineId, firestore]);

  const updatePrice = useCallback((newPrice: number) => {
    setPricePerSong(newPrice);
    localStorage.setItem('jukebox_price', newPrice.toString());
    if (machineId && firestore) {
      updateDoc(doc(firestore, 'machines', machineId), { pricePerSong: newPrice })
        .catch(err => console.error("Erro ao atualizar preço:", err));
    }
  }, [machineId, firestore]);

  const updateRandomPlay = useCallback((enabled: boolean, interval: number) => {
    setRandomPlayEnabled(enabled);
    setRandomPlayInterval(interval);
    localStorage.setItem('jukebox_random_enabled', enabled.toString());
    localStorage.setItem('jukebox_random_interval', interval.toString());
    if (machineId && firestore) {
      updateDoc(doc(firestore, 'machines', machineId), { 
        randomPlayEnabled: enabled,
        randomPlayInterval: interval 
      }).catch(err => console.error("Erro ao atualizar música aleatória:", err));
    }
  }, [machineId, firestore]);

  const updateHiddenGenres = useCallback((genres: string[]) => {
    setHiddenGenres(genres);
    if (machineId && firestore) {
      updateDoc(doc(firestore, 'machines', machineId), { 
        hiddenGenres: genres
      }).catch(err => console.error("Erro ao sincronizar gêneros ocultos:", err));
    }
  }, [machineId, firestore]);



  // Persistência imediata do MP Token e Machine ID
  useEffect(() => {
    if (mpAccessToken) localStorage.setItem('jukebox_mp_token', mpAccessToken);
  }, [mpAccessToken]);

  const requestUsbPermission = useCallback(async () => {
    if (!usbHandle) return false;
    try {
      const permission = await (usbHandle as any).requestPermission({ mode: 'read' });
      const authorized = permission === 'granted';
      setIsUsbAuthorized(authorized);
      if (authorized) {
        loadData(); // Recarrega os dados agora que temos acesso
      }
      return authorized;
    } catch (err) {
      console.warn("[Jukebox] Permissão USB não concedida automaticamente.");
      return false;
    }
  }, [usbHandle, loadData]);

  // Tentativa de auto-autorização no primeiro clique/tecla (Gesto do Usuário)
  useEffect(() => {
    if (!usbHandle || isUsbAuthorized) return;

    const attemptAutoAuth = async () => {
      const authorized = await requestUsbPermission();
      if (authorized) {
        window.removeEventListener('click', attemptAutoAuth);
        window.removeEventListener('keydown', attemptAutoAuth);
      }
    };

    window.addEventListener('click', attemptAutoAuth, { once: true });
    window.addEventListener('keydown', attemptAutoAuth, { once: true });
    
    return () => {
      window.removeEventListener('click', attemptAutoAuth);
      window.removeEventListener('keydown', attemptAutoAuth);
    };
  }, [usbHandle, isUsbAuthorized, requestUsbPermission]);

  const resolveDirectAccessFile = useCallback(async (path: string) => {
    // Caso Desktop/Browser (File System Access API)
    if (!usbHandle || !isUsbAuthorized) return null;
    try {
      const parts = path.split('/');
      let current: any = usbHandle;
      for (let i = 0; i < parts.length - 1; i++) {
        current = await current.getDirectoryHandle(parts[i]);
      }
      const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
      return await fileHandle.getFile();
    } catch (err) {
      console.error(`Erro ao resolver arquivo USB: ${path}`, err);
      return null;
    }
  }, [usbHandle, isUsbAuthorized]);

  const playRandomAction = useCallback(async () => {
    if (customAlbums.length === 0) return;
    
    // Escolhe um álbum aleatório que tenha músicas
    const albumsWithTracks = customAlbums.filter(a => a.tracks && a.tracks.length > 0);
    if (albumsWithTracks.length === 0) return;

    const randomAlbum = albumsWithTracks[Math.floor(Math.random() * albumsWithTracks.length)];
    const randomTrack = randomAlbum.tracks[Math.floor(Math.random() * randomAlbum.tracks.length)];

    let fileToPlay = randomTrack.file;
    if (randomAlbum.isDirectAccess && randomTrack.relativePath) {
      if (isUsbAuthorized) {
        fileToPlay = (await resolveDirectAccessFile(randomTrack.relativePath)) || undefined;
      }
    }

    if (!fileToPlay && randomAlbum.isDirectAccess) {
      console.warn("[Jukebox] Chama Clientes: Não foi possível resolver o arquivo USB.");
      return;
    }

    const queued: QueuedTrack = {
      ...randomTrack,
      albumTitle: randomAlbum.title,
      artist: randomAlbum.artist,
      file: fileToPlay,
      isRandomAutoPlay: true
    };
    
    setQueue(prev => [...prev, queued]);
    console.log(`[Jukebox] Chama Clientes: Tocando "${randomTrack.title}" de ${randomAlbum.artist}`);
  }, [customAlbums, isUsbAuthorized, resolveDirectAccessFile]);

  // Timer para Música Aleatória (Chama Clientes)
  useEffect(() => {
    if (!randomPlayEnabled || queue.length > 0 || currentTrack) return;

    const intervalMs = randomPlayInterval * 60 * 1000;
    const timer = setTimeout(() => {
      playRandomAction();
    }, intervalMs);

    return () => clearTimeout(timer);
  }, [randomPlayEnabled, randomPlayInterval, queue.length, currentTrack, playRandomAction]);

  const updateBonusConfig = useCallback((config: Record<string, number>) => {
    setBonusConfig(config);
    localStorage.setItem('jukebox_bonus_config', JSON.stringify(config));
    if (machineId && firestore) {
      updateDoc(doc(firestore, 'machines', machineId), { bonusConfig: config })
        .catch(err => console.error("Erro ao atualizar bônus:", err));
    }
  }, [machineId, firestore]);

  const addToQueue = useCallback(async (track: Track, album: Album) => {
    if (credits >= pricePerSong) {
      let fileToPlay = track.file;

      if (album.isDirectAccess && track.relativePath) {
        if (!isUsbAuthorized) {
          const ok = await requestUsbPermission();
          if (!ok) {
            setMessage("USB NÃO AUTORIZADO");
            setTimeout(() => setMessage(""), 2000);
            return false;
          }
        }
        setMessage("LENDO USB...");
        fileToPlay = (await resolveDirectAccessFile(track.relativePath)) || undefined;
        if (!fileToPlay) {
          setMessage("ERRO AO LER USB");
          setTimeout(() => setMessage(""), 2000);
          return false;
        }
      }

      setCredits(prev => prev - pricePerSong);
      // Removido incremento de totalRevenue aqui, pois agora rastreamos na entrada (addCredit/addPixRevenue)

      
      const newQueuedTrack: QueuedTrack = { 
        ...track, 
        albumTitle: album.title, 
        artist: album.artist,
        file: fileToPlay
      };
      setQueue(prev => [...prev, newQueuedTrack]);
      setMessage("PEDIDO REALIZADO!");
      setTimeout(() => setMessage(""), 1000);
      return true;
    } else {
      setMessage(`SALDO INSUFICIENTE`);
      setTimeout(() => setMessage(""), 2000);
      return false;
    }
  }, [credits, pricePerSong, isUsbAuthorized, usbHandle, requestUsbPermission, resolveDirectAccessFile]);

  const playNext = useCallback(() => {
    // Segurança: Não pula se já tiver algo tocando
    if (currentTrack) return null;
    
    if (queue.length > 0) {
      const next = queue[0];
      setQueue(prev => prev.slice(1));
      setCurrentTrack(next);
      return next;
    }
    setCurrentTrack(null);
    return null;
  }, [queue, currentTrack]);

  const getVisualizerUrl = useCallback(async () => {
    if (customVisualizers.length > 0) {
      const randomViz = customVisualizers[Math.floor(Math.random() * customVisualizers.length)];
      
      let file = randomViz.file;
      if (randomViz.relativePath && usbHandle) {
        if (isUsbAuthorized) {
          file = (await resolveDirectAccessFile(randomViz.relativePath)) || undefined;
        }
      }

      if (!file) return DEFAULT_VISUALIZERS[Math.floor(Math.random() * DEFAULT_VISUALIZERS.length)];

      const url = URL.createObjectURL(file);
      if (activeVisualizerBlobUrlRef.current) URL.revokeObjectURL(activeVisualizerBlobUrlRef.current);
      activeVisualizerBlobUrlRef.current = url;
      return url;
    }
    return DEFAULT_VISUALIZERS[Math.floor(Math.random() * DEFAULT_VISUALIZERS.length)];
  }, [customVisualizers, usbHandle, isUsbAuthorized, resolveDirectAccessFile]);

  return {
    credits,
    setCredits,
    message,
    setMessage,
    customAlbums,
    customVisualizers,
    currentTrack,
    setCurrentTrack,
    queue,
    setQueue,
    pricePerSong,
    updatePrice,
    setPricePerSong,
    revenueCash,
    setRevenueCash,
    revenuePix,
    setRevenuePix,
    partialRevenueCash,
    partialRevenuePix,
    lastResetDate,
    resetPartialRevenue,
    randomPlayEnabled,
    randomPlayInterval,
    updateRandomPlay,
    bonusConfig,
    updateBonusConfig,
    hiddenGenres,
    updateHiddenGenres,
    linkCode,
    isLinked,

    setHiddenGenres,
    addCredit,
    isUpdateDiskPresent,
    isSystemLocked,
    addToQueue,
    playNext,
    getVisualizerUrl,
    loadData,
    usbHandle,
    isUsbAuthorized,
    requestUsbPermission,
    clearUSBHandle,
    addPixRevenue,
    mpAccessToken,

    setMpAccessToken,
    machineId,
    machineName,
    activeMediaUrlRef,
    activeVisualizerBlobUrlRef
  };
};
