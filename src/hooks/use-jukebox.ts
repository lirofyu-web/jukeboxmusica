"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Album, ALBUMS, Track, QueuedTrack, VisualizerVideo } from '@/lib/jukebox-data';
import { getAllAlbums, getAllVisualizers, getUSBHandle, clearUSBHandle } from '@/lib/db';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';

const DEFAULT_VISUALIZERS = [
  "https://assets.mixkit.co/videos/preview/mixkit-abstract-motion-background-with-pinks-and-purples-34443-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-abstract-lines-and-dots-in-blue-background-20822-large.mp4"
];

const FALLBACK_COVER = "https://picsum.photos/seed/music/800/800";

export const useJukebox = () => {
  const [credits, setCredits] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [customAlbums, setCustomAlbums] = useState<Album[]>([]);
  const [customVisualizers, setCustomVisualizers] = useState<VisualizerVideo[]>([]);
  const [currentTrack, setCurrentTrack] = useState<QueuedTrack | null>(null);
  const [queue, setQueue] = useState<QueuedTrack[]>([]);
  const [pricePerSong, setPricePerSong] = useState(0.50);
  const [revenueCash, setRevenueCash] = useState(0);
  const [revenuePix, setRevenuePix] = useState(0);
  const [hiddenGenres, setHiddenGenres] = useState<string[]>([]);

  const [mpAccessToken, setMpAccessToken] = useState<string>("");
  const [machineId, setMachineId] = useState<string>(`jukebox-${Math.random().toString(36).substring(7)}`);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [activeVisualizerUrl, setActiveVisualizerUrl] = useState<string>("");
  const [usbHandle, setUsbHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isUsbAuthorized, setIsUsbAuthorized] = useState(false);

  const albumObjectUrlsRef = useRef<Map<string, string>>(new Map());
  const activeMediaUrlRef = useRef<string | null>(null);
  const activeVisualizerBlobUrlRef = useRef<string | null>(null);

  const isInitialLoadDoneRef = useRef(false);

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
        // Verifica se já tem permissão (raro em novo carregamento sem gesto)
        const permission = await (handle as any).queryPermission();
        setIsUsbAuthorized(permission === 'granted');
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


          const savedHidden = localStorage.getItem('jukebox_hidden_genres');
          if (savedHidden) setHiddenGenres(JSON.parse(savedHidden));

          const savedCredits = localStorage.getItem('jukebox_credits');
          if (savedCredits) setCredits(Number(savedCredits));
          
          const savedMPToken = localStorage.getItem('jukebox_mp_token');
          if (savedMPToken) setMpAccessToken(savedMPToken);

          const savedMachineId = localStorage.getItem('jukebox_machine_id');
          if (savedMachineId) setMachineId(savedMachineId);

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
      localStorage.setItem('jukebox_price', pricePerSong.toString());
      localStorage.setItem('jukebox_revenue_cash', revenueCash.toString());
      localStorage.setItem('jukebox_revenue_pix', revenuePix.toString());

      localStorage.setItem('jukebox_hidden_genres', JSON.stringify(hiddenGenres));
      localStorage.setItem('jukebox_credits', credits.toString());
      localStorage.setItem('jukebox_mp_token', mpAccessToken);
      localStorage.setItem('jukebox_machine_id', machineId);
    }
  }, [pricePerSong, revenueCash, revenuePix, hiddenGenres, credits, mpAccessToken, machineId, isInitialLoadDone]);


  const addCredit = useCallback(() => {
    setCredits(prev => {
      const newVal = prev + 0.50;
      localStorage.setItem('jukebox_credits', newVal.toString());
      return newVal;
    });
    setRevenueCash(prev => prev + 0.50);

    setMessage("CRÉDITO OK!");
    setTimeout(() => setMessage(""), 1500);
  }, []);

  const addPixRevenue = useCallback((amount: number) => {
    setRevenuePix(prev => prev + amount);
  }, []);


  // Persistência imediata do MP Token e Machine ID
  useEffect(() => {
    if (mpAccessToken) localStorage.setItem('jukebox_mp_token', mpAccessToken);
  }, [mpAccessToken]);

  useEffect(() => {
    if (machineId) localStorage.setItem('jukebox_machine_id', machineId);
  }, [machineId]);

  const requestUsbPermission = useCallback(async () => {
    if (!usbHandle) return false;
    try {
      const permission = await (usbHandle as any).requestPermission({ mode: 'read' });
      const authorized = permission === 'granted';
      setIsUsbAuthorized(authorized);
      return authorized;
    } catch (err) {
      console.error("Erro ao solicitar permissão USB:", err);
      return false;
    }
  }, [usbHandle]);

  const resolveDirectAccessFile = useCallback(async (path: string) => {
    // Caso Android/Capacitor
    if (Capacitor.getPlatform() === 'android') {
      try {
        const result = await Filesystem.readFile({
          path: path
        });
        
        const response = await fetch(`data:audio/mpeg;base64,${result.data}`);
        return await response.blob();
      } catch (err) {
        console.error(`Erro ao ler arquivo Android: ${path}`, err);
        return null;
      }
    }

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
    if (queue.length > 0) {
      const next = queue[0];
      setQueue(prev => prev.slice(1));
      setCurrentTrack(next);
      return next;
    }
    setCurrentTrack(null);
    return null;
  }, [queue]);

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
    setPricePerSong,
    revenueCash,
    setRevenueCash,
    revenuePix,
    setRevenuePix,
    hiddenGenres,

    setHiddenGenres,
    addCredit,
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
    setMachineId,
    activeMediaUrlRef,
    activeVisualizerBlobUrlRef
  };
};
