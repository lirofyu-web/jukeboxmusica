"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Album, Track, GENRES, VisualizerVideo } from '@/lib/jukebox-data';
import { 
  X, HardDrive, DollarSign, Ban, Settings2, Trash2, RefreshCw, Video, 
  FolderTree, CreditCard, LogOut, Film, Plus, Minus, Star,
  Keyboard as KeyboardIcon, MousePointer2, Smartphone 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  saveAlbum, saveAlbumsBulk, getAllAlbums, deleteAlbumFromDB, saveSettings, 
  getSettings, clearVisualizers, getAllVisualizers, saveSingleVisualizer, 
  deleteVisualizer, saveUSBHandle 
} from '@/lib/db';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useFirestore } from '@/firebase/provider';
import { doc, onSnapshot } from 'firebase/firestore';

interface AdminMenuProps {
  onClose: () => void;
  onLogout: () => void;
  onAddAlbumsBulk: (albums: Album[]) => void;
  onDeleteAlbum: (id: string) => void;
  albums: Album[];
  pricePerSong: number;
  onUpdatePrice: (price: number) => void;
  revenueCash: number;
  revenuePix: number;
  partialRevenueCash: number;
  partialRevenuePix: number;
  lastResetDate: string;
  onResetPartial: () => void;
  randomPlayEnabled: boolean;
  randomPlayInterval: number;
  onUpdateRandomPlay: (enabled: boolean, interval: number) => void;
  bonusConfig: Record<string, number>;
  onUpdateBonusConfig: (config: Record<string, number>) => void;
  hiddenGenres: string[];
  onUpdateHiddenGenres: (genres: string[]) => void;
  visualizerCount: number;
  onVisualizersUpdated: () => void;
  mpAccessToken: string;
  setMpAccessToken: (token: string) => void;
  machineId: string;
}

type FocusableId = 'close-btn' | 'sync-btn' | 'sync-direct-btn' | 'price-input' | 'mp-token-input' | 'machine-id-input' | 'clear-lib' | 'clear-viz' | string;

export const AdminMenu: React.FC<AdminMenuProps> = ({ 
  onClose, 
  onLogout,
  onAddAlbumsBulk,
  onDeleteAlbum,
  albums,
  pricePerSong, 
  onUpdatePrice, 
  revenueCash,
  revenuePix,
  partialRevenueCash,
  partialRevenuePix,
  lastResetDate,
  onResetPartial,
  randomPlayEnabled,
  randomPlayInterval,
  onUpdateRandomPlay,
  bonusConfig,
  onUpdateBonusConfig,
  hiddenGenres,
  onUpdateHiddenGenres,
  visualizerCount,
  onVisualizersUpdated,
  mpAccessToken,
  setMpAccessToken,
  machineId
}) => {
  const firestore = useFirestore();
  const [machineName, setMachineName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
  const [focusedId, setFocusedId] = useState<FocusableId>('sync-btn');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [visualizers, setVisualizers] = useState<VisualizerVideo[]>([]);
  const [wifiNetworks, setWifiNetworks] = useState<any[]>([]);
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiStatus, setWifiStatus] = useState<string>("");
  const [linkCodeInput, setLinkCodeInput] = useState('');
  const [isLinkedLocally, setIsLinkedLocally] = useState(false);

  // Key Mapping States
  const [keyMappings, setKeyMappings] = useState<Record<string, string>>({
    KEY_MENU: 'm',
    KEY_CREDIT: 'c',
    KEY_UP: 'arrowup',
    KEY_DOWN: 'arrowdown',
    KEY_LEFT: 'arrowleft',
    KEY_RIGHT: 'arrowright',
    KEY_SELECT: 'i',
    KEY_CHOOSE_ALBUM: '1',
    KEY_PLAY_TRACK: '2',
    KEY_BACK: 'x',
    KEY_VOL_CONTROL: 'v',
    KEY_VOL_UP: '+',
    KEY_VOL_DOWN: '-',
    KEY_PIX: 'p'
  });
  const [recordingAction, setRecordingAction] = useState<string | null>(null);

  const loadMappings = useCallback(async () => {
    const saved = await getSettings<Record<string, string>>('keyMappings');
    if (saved) setKeyMappings(prev => ({ ...prev, ...saved }));
  }, []);

  const loadVisualizers = useCallback(async () => {
    const v = await getAllVisualizers();
    setVisualizers(v);
  }, []);

  const loadWifi = useCallback(async () => {
    if (typeof window !== 'undefined' && (window as any).jukeboxAPI) {
      const nets = await (window as any).jukeboxAPI.listWifi();
      setWifiNetworks(nets);
    }
  }, []);

  useEffect(() => {
    loadMappings();
    loadVisualizers();
    loadWifi();
    const interval = setInterval(loadWifi, 10000);
    return () => clearInterval(interval);
  }, [loadMappings, loadVisualizers, loadWifi]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setStatus("Adicionando vídeos...");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const viz: VisualizerVideo = {
        id: `viz-${Date.now()}-${i}`,
        name: file.name,
        file: file
      };
      await saveSingleVisualizer(viz);
    }
    
    loadVisualizers();
    onVisualizersUpdated();
    setStatus(`Adicionados ${files.length} vídeos.`);
    setIsProcessing(false);
    if (videoInputRef.current) videoInputRef.current.value = ''; // Clear input
  };

  const handleDeleteVideo = async (id: string) => {
    if (confirm("Tem certeza que deseja remover este vídeo?")) {
      await deleteVisualizer(id);
      loadVisualizers();
      onVisualizersUpdated();
      setStatus("Vídeo removido.");
    }
  };

  useEffect(() => {
    if (!firestore || !machineId) return;
    const unsub = onSnapshot(doc(firestore, 'machines', machineId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMachineName(data.name || null);
        setIsLinkedLocally(!!data.hardwareId);
      } else {
        setIsLinkedLocally(false);
      }
    });
    return () => unsub();
  }, [firestore, machineId]);

  const focusableSequence: FocusableId[] = [
    'close-btn',
    ...GENRES.map(g => `genre-select-${g}`),
    'sync-btn',
    'sync-direct-btn',
    'price-minus',
    'price-plus',
    'logout-btn',
    'clear-lib',
    'clear-viz',
    'reset-partial-btn',
    'random-play-toggle',
    'random-interval-15',
    'random-interval-30',
    'random-interval-60',
    'wifi-password',
    ...wifiNetworks.map(n => `wifi-connect-${n.ssid}`),
    'bonus-5',
    'bonus-10',
    'bonus-20',
    'bonus-50',
    'map-KEY_UP',
    'map-KEY_DOWN',
    'map-KEY_LEFT',
    'map-KEY_RIGHT',
    'map-KEY_SELECT',
    'map-KEY_CHOOSE_ALBUM',
    'map-KEY_PLAY_TRACK',
    'map-KEY_BACK',
    'map-KEY_VOL_CONTROL',
    'map-KEY_VOL_UP',
    'map-KEY_VOL_DOWN',
    'map-KEY_CREDIT',
    'map-KEY_PIX',
    'map-KEY_MENU',
    'link-code-input',
    'link-code-btn',
    'upload-video-btn',
    ...visualizers.map(v => `video-del-${v.id}`),
    ...GENRES.map(g => `toggle-genre-${g}`),
    ...albums.map(a => `album-del-${a.id}`)
  ];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (recordingAction) {
      e.preventDefault();
      const newKey = e.key.toLowerCase();
      const updated = { ...keyMappings, [recordingAction]: newKey };
      setKeyMappings(updated);
      saveSettings('keyMappings', updated);
      window.dispatchEvent(new CustomEvent('jukebox-reload-settings'));
      setRecordingAction(null);
      setStatus(`TECLA SALVA: ${newKey.toUpperCase()}`);
      return;
    }

    const key = e.key.toLowerCase();
    const currentIndex = focusableSequence.indexOf(focusedId);
    
    if (key === keyMappings.KEY_DOWN.toLowerCase()) {
        e.preventDefault();
        setFocusedId(focusableSequence[(currentIndex + 1) % focusableSequence.length]);
    } else if (key === keyMappings.KEY_UP.toLowerCase()) {
        e.preventDefault();
        setFocusedId(focusableSequence[(currentIndex - 1 + focusableSequence.length) % focusableSequence.length]);
    } else if (key === keyMappings.KEY_SELECT.toLowerCase() || key === 'enter') {
        if (focusedId === 'sync-btn') {
          fileInputRef.current?.click();
        } else if (focusedId === 'sync-direct-btn') {
          handleSyncDirectAccess();
        } else if (focusedId === 'logout-btn') {
          onLogout();
        } else if (focusedId === 'upload-video-btn') {
          videoInputRef.current?.click();
        } else if (focusedId.startsWith('video-del-')) {
          const id = focusedId.replace('video-del-', '');
          handleDeleteVideo(id);
        } else if (focusedId === 'reset-partial-btn') {
          if (confirm("Deseja zerar o relógio parcial?")) onResetPartial();
        } else if (focusedId === 'random-play-toggle') {
          onUpdateRandomPlay(!randomPlayEnabled, randomPlayInterval);
        } else if (focusedId.startsWith('random-interval-')) {
          const interval = parseInt(focusedId.replace('random-interval-', ''));
          onUpdateRandomPlay(true, interval);
        } else if (focusedId.startsWith('bonus-')) {
          const key = focusedId.replace('bonus-', '');
          // Implementação simples de toggle/ciclo ou incremento
          // Vamos fazer incremento de 1 em 1 até 50 (ou similar)
          // Mas como não temos botões +/- separados na sequência de foco para simplicidade de navegação,
          // Vamos usar as teclas de setas laterais para ajustar quando focado ou cliques sucessivos.
          // Para o usuário que está usando Teclado/Controle, vamos usar Enter para +1.
          const current = bonusConfig[key] || 0;
          const next = (current + 1) % 51;
          onUpdateBonusConfig({ ...bonusConfig, [key]: next });
        } else if (focusedId === 'price-minus') {
          onUpdatePrice(Math.max(0.50, pricePerSong - 0.50));
        } else if (focusedId === 'price-plus') {
          onUpdatePrice(pricePerSong + 0.50);
        } else if (focusedId.startsWith('map-')) {
          const action = focusedId.replace('map-', '');
          setRecordingAction(action);
          setStatus("PRESSIONE A NOVA TECLA...");
        } else if (focusedId === 'link-code-btn') {
          handleManualLink();
        } else if (focusedId.startsWith('wifi-connect-')) {
          const ssid = focusedId.replace('wifi-connect-', '');
          handleConnectWifi(ssid);
        }
    } else if (key === keyMappings.KEY_BACK.toLowerCase() || (keyMappings.KEY_BACK === 'backspace' && key === 'escape')) {
        if (!isProcessing && !recordingAction) onClose();
    }
  }, [focusedId, focusableSequence, isProcessing, onClose, recordingAction, keyMappings, onLogout]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const el = document.getElementById(focusedId);
    if (el) el.focus();
  }, [focusedId]);

  const toggleGenreVisibility = (genre: string) => {
    if (hiddenGenres.includes(genre)) {
      onUpdateHiddenGenres(hiddenGenres.filter(g => g !== genre));
    } else {
      onUpdateHiddenGenres([...hiddenGenres, genre]);
    }
  };

  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));

  const handleSyncFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    setIsProcessing(true);
    setStatus("Analisando arquivos...");
    await yieldToUI();

    const folderGroups: Record<string, any> = {};
    const visualizerFiles: File[] = [];
    const allImages: File[] = [];

    const totalFiles = rawFiles.length;
    for (let i = 0; i < totalFiles; i++) {
      const file = rawFiles[i];
      const pathParts = file.webkitRelativePath.split('/');
      if (pathParts.length < 2) continue;

      const name = file.name.toLowerCase();
      if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
        allImages.push(file);
      }

      if (pathParts.some(p => p.toLowerCase() === 'backgrounds')) {
        if (name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mkv')) {
          visualizerFiles.push(file);
        }
        continue;
      }

      const folderPath = pathParts.slice(0, -1).join('/');
      const internalPath = pathParts.slice(1, -1).join('/');
      
      if (!folderGroups[folderPath]) {
        folderGroups[folderPath] = {
          files: [],
          albumName: pathParts[pathParts.length - 2] || "Desconhecido",
          parentName: pathParts.length >= 4 ? pathParts[pathParts.length - 3] : (pathParts.length === 3 ? pathParts[1] : "Vários"),
          rootGenre: pathParts.length >= 4 ? pathParts[1] : (pathParts[0] || "Geral"),
          internalPath
        };
      }
      folderGroups[folderPath].files.push(file);
    }

    const albumsToBatch: Album[] = [];
    let albumsWithCover = 0;

    for (const folderPath of Object.keys(folderGroups)) {
      const group = folderGroups[folderPath];
      const audioFiles = group.files.filter((f: File) => {
        const n = f.name.toLowerCase();
        return n.endsWith('.mp3') || n.endsWith('.mp4') || n.endsWith('.webm') || n.endsWith('.mkv');
      });

      if (audioFiles.length === 0) continue;

      let foundImages = allImages.filter(f => {
         const p = f.webkitRelativePath.split('/');
         return p.slice(0, -1).join('/') === folderPath || f.webkitRelativePath.startsWith(folderPath + '/');
      });

      let bestCoverBlob: Blob | undefined = undefined;
      if (foundImages.length > 0) {
        const preferred = foundImages.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('capa') || n.includes('cover') || n.includes('front');
        });
        bestCoverBlob = preferred || foundImages.reduce((prev, curr) => (curr.size > prev.size ? curr : prev), foundImages[0]);
        albumsWithCover++;
      }

      const albumId = `album-${group.internalPath.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'root'}`;
      const tracks: Track[] = audioFiles.map((file: File) => ({
        id: `track-${albumId}-${file.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        duration: "--:--",
        file: file,
        type: file.name.toLowerCase().endsWith('.mp3') ? 'audio' : 'video'
      }));

      albumsToBatch.push({
        id: albumId,
        title: group.albumName,
        artist: group.parentName,
        genre: group.rootGenre || selectedGenre,
        coverUrl: `https://picsum.photos/seed/${encodeURIComponent(albumId)}/600/600`,
        coverBlob: bestCoverBlob,
        tracks: tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
      });
    }

    if (visualizerFiles.length > 0) {
      for (const f of visualizerFiles) {
        const viz: VisualizerVideo = {
          id: `viz-${f.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: f.name,
          file: f
        };
        await saveSingleVisualizer(viz);
      }
      loadVisualizers();
      onVisualizersUpdated();
    }

    if (albumsToBatch.length > 0) {
      onAddAlbumsBulk(albumsToBatch);
      setStatus(`OK: ${albumsToBatch.length} Álbuns (${albumsWithCover} com capa)`);
    }
    setIsProcessing(false);
  };

  const handleConnectWifi = async (ssid: string) => {
    if (!wifiPassword) {
      setWifiStatus("ERRO: DIGITE A SENHA PRIMEIRO!");
      setFocusedId('wifi-password');
      return;
    }
    
    setIsProcessing(true);
    setWifiStatus(`CONECTANDO A ${ssid}...`);
    
    if (typeof window !== 'undefined' && (window as any).jukeboxAPI) {
      const result = await (window as any).jukeboxAPI.connectWifi(ssid, wifiPassword);
      if (result.success) {
        setWifiStatus("SUCESSO: WI-FI CONECTADO!");
        setWifiPassword("");
      } else {
        setWifiStatus(`ERRO: ${result.error || "FALHA NA CONEXÃO"}`);
      }
    }
    setIsProcessing(false);
  };

  const handleSyncDirectAccess = async () => {
    try {
      if (Capacitor.getPlatform() === 'android') {
        handleAndroidSync();
        return;
      }

      if (!(window as any).showDirectoryPicker) {
        alert("Acesso Direto requer Chrome ou Edge. No Android, use o app nativo.");
        return;
      }

      const handle = await (window as any).showDirectoryPicker();
      setIsProcessing(true);
      setStatus("Sincronizando USB...");

      const allFiles: { file: File, path: string }[] = [];
      async function scanDirectory(dirHandle: any, currentPath: string = "") {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            allFiles.push({ file, path: currentPath ? `${currentPath}/${entry.name}` : entry.name });
          } else if (entry.kind === 'directory') {
            await scanDirectory(entry, currentPath ? `${currentPath}/${entry.name}` : entry.name);
          }
        }
      }

      await scanDirectory(handle, "");
      
      const folderGroups: Record<string, any> = {};
      const allImages: any[] = [];
      const visualizerFiles: File[] = [];

      for (const item of allFiles) {
        const { file, path } = item;
        const name = file.name.toLowerCase();
        if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
          allImages.push({ file, path });
        }
        
        if (path.toLowerCase().includes('backgrounds')) {
          if (name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mkv')) {
            visualizerFiles.push(file);
          }
          continue;
        }

        const folderPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : "";
        if (!folderGroups[folderPath]) {
          const parts = path.split('/');
          folderGroups[folderPath] = {
            files: [],
            albumName: parts.length > 1 ? parts[parts.length - 2] : "Raiz",
            parentName: parts.length > 2 ? parts[parts.length - 3] : "Vários",
            rootGenre: parts[0] || "Geral"
          };
        }
        folderGroups[folderPath].files.push(item);
      }

      const albumsToBatch: Album[] = [];
      for (const folderPath of Object.keys(folderGroups)) {
        const group = folderGroups[folderPath];
        const audioFiles = group.files.filter((f: any) => {
          const n = f.file.name.toLowerCase();
          return n.endsWith('.mp3') || n.endsWith('.mp4') || n.endsWith('.webm') || n.endsWith('.mkv');
        });

        if (audioFiles.length === 0) continue;

        let bestCoverBlob: Blob | undefined = allImages.find(img => img.path.startsWith(folderPath))?.file;

        const albumId = `usb-${folderPath.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'root'}`;
        const tracks: Track[] = audioFiles.map((item: any) => ({
          id: `track-${albumId}-${item.file.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          title: item.file.name.replace(/\.[^/.]+$/, ""),
          duration: "--:--",
          relativePath: item.path,
          type: item.file.name.toLowerCase().endsWith('.mp3') ? 'audio' : 'video'
        }));

        albumsToBatch.push({
          id: albumId,
          title: group.albumName,
          artist: group.parentName,
          genre: group.rootGenre,
          coverUrl: `https://picsum.photos/seed/${encodeURIComponent(albumId)}/600/600`,
          coverBlob: bestCoverBlob,
          isDirectAccess: true,
          tracks: tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
        });
      }

      if (visualizerFiles.length > 0) {
        for (const f of visualizerFiles) {
          const viz: VisualizerVideo = {
            id: `viz-${f.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: f.name,
            file: f
          };
          await saveSingleVisualizer(viz);
        }
        loadVisualizers();
        onVisualizersUpdated();
      }

      await saveUSBHandle(handle);
      onAddAlbumsBulk(albumsToBatch);
      setStatus(`USB Direto Ativo: ${albumsToBatch.length} Álbuns`);
      setIsProcessing(false);
    } catch (err) {
      console.error(err);
      setStatus("Erro USB");
      setIsProcessing(false);
    }
  };

  const handleAndroidSync = async () => {
    try {
      setIsProcessing(true);
      setStatus("Solicitando Permissão...");
      
      const permission = await Filesystem.requestPermissions();
      if (permission.publicStorage !== 'granted') {
        setStatus("Permissão Negada");
        setIsProcessing(false);
        return;
      }

      setStatus("Escolha a pasta de músicas (Ex: /storage/emulated/0/Music)");
      const pathInput = prompt("Digite o caminho da pasta no Android:", "/storage/emulated/0/Music");
      if (!pathInput) {
        setIsProcessing(false);
        return;
      }

      setStatus("Sincronizando Android...");
      const albumsToBatch: Album[] = [];
      const allFiles: { name: string, path: string }[] = [];
      const visualizerFiles: { name: string, path: string }[] = [];

      async function scanDirectory(path: string) {
        const result = await Filesystem.readdir({
          path: path,
          directory: Directory.ExternalStorage 
        });

        for (const file of result.files) {
          const fullPath = `${path}/${file.name}`;
          if (file.type === 'directory') {
            await scanDirectory(fullPath);
          } else {
            if (fullPath.toLowerCase().includes('backgrounds') && (file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.webm') || file.name.toLowerCase().endsWith('.mkv'))) {
              visualizerFiles.push({ name: file.name, path: fullPath });
            } else {
              allFiles.push({ name: file.name, path: fullPath });
            }
          }
        }
      }

      await scanDirectory(pathInput.replace('/storage/emulated/0', ''));

      const folderGroups: Record<string, any> = {};
      
      for (const item of allFiles) {
        const name = item.name.toLowerCase();
        if (name.includes('backgrounds')) continue;

        const folderPath = item.path.includes('/') ? item.path.substring(0, item.path.lastIndexOf('/')) : "";
        if (!folderGroups[folderPath]) {
          const parts = item.path.split('/');
          folderGroups[folderPath] = {
            files: [],
            albumName: parts.length > 1 ? parts[parts.length - 2] : "Raiz",
            parentName: parts.length > 2 ? parts[parts.length - 3] : "Vários",
            rootGenre: parts[0] || "Geral"
          };
        }
        folderGroups[folderPath].files.push(item);
      }

      for (const folderPath of Object.keys(folderGroups)) {
        const group = folderGroups[folderPath];
        const audioFiles = group.files.filter((f: any) => {
          const n = f.name.toLowerCase();
          return n.endsWith('.mp3') || n.endsWith('.mp4') || n.endsWith('.webm') || n.endsWith('.mkv');
        });

        if (audioFiles.length === 0) continue;

        // Tentar encontrar uma imagem na mesma pasta para o cover
        const imageFiles = group.files.filter((f: any) => {
          const n = f.name.toLowerCase();
          return n.endsWith('.jpg') || n.endsWith('.png') || n.endsWith('.jpeg') || n.endsWith('.webp');
        });

        let bestCoverBlob: Blob | undefined = undefined;
        if (imageFiles.length > 0) {
          try {
            // Prioriza arquivos que tenham 'capa', 'cover' ou 'front' no nome
            const preferred = imageFiles.find((f: any) => {
              const n = f.name.toLowerCase();
              return n.includes('capa') || n.includes('cover') || n.includes('front');
            }) || imageFiles[0];

            setStatus(`Lendo capa: ${preferred.name}`);
            const result = await Filesystem.readFile({
              path: preferred.path,
              directory: Directory.ExternalStorage
            });
            
            const response = await fetch(`data:image/jpeg;base64,${result.data}`);
            bestCoverBlob = await response.blob();
          } catch (err) {
            console.error("Erro ao carregar capa no Android:", err);
          }
        }

        const albumId = `android-${folderPath.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'root'}`;
        const tracks: Track[] = audioFiles.map((item: any) => ({
          id: `track-${albumId}-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          title: item.name.replace(/\.[^/.]+$/, ""),
          duration: "--:--",
          relativePath: item.path,
          type: item.name.toLowerCase().endsWith('.mp3') ? 'audio' : 'video'
        }));

        albumsToBatch.push({
          id: albumId,
          title: group.albumName,
          artist: group.parentName,
          genre: group.rootGenre || selectedGenre,
          coverUrl: `https://picsum.photos/seed/${encodeURIComponent(albumId)}/600/600`,
          coverBlob: bestCoverBlob,
          isDirectAccess: true,
          tracks: tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
        });
      }

      if (visualizerFiles.length > 0) {
        for (const f of visualizerFiles) {
          const viz: VisualizerVideo = {
            id: `viz-${f.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: f.name,
            file: undefined, // File object not directly available from path, will be loaded on demand
            relativePath: f.path
          };
          await saveSingleVisualizer(viz);
        }
        loadVisualizers();
        onVisualizersUpdated();
      }

      if (albumsToBatch.length > 0) {
        onAddAlbumsBulk(albumsToBatch);
        setStatus(`Android OK: ${albumsToBatch.length} Álbuns`);
      } else {
        setStatus("Nenhuma música encontrada");
      }
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setStatus(`Erro: ${err.message || "Android"}`);
      setIsProcessing(false);
    }
  };

  const handleManualLink = async () => {
    if (!linkCodeInput || !firestore || !machineId) return;
    setIsProcessing(true);
    setStatus("Verificando código...");
    try {
      const { collection, query, where, limit, getDocs, setDoc, doc, serverTimestamp, deleteDoc } = await import('firebase/firestore');
      const q = query(collection(firestore, 'machines'), where('activationCode', '==', linkCodeInput.toUpperCase()), limit(1));
      const snaps = await getDocs(q);
      
      if (!snaps.empty) {
        const targetDoc = snaps.docs[0];
        await setDoc(doc(firestore, 'machines', machineId), {
          ...targetDoc.data(),
          hardwareId: machineId,
          status: 'online',
          lastPing: serverTimestamp(),
          activationCode: null
        });
        await deleteDoc(doc(firestore, 'machines', targetDoc.id));
        setStatus("VÍNCULO REALIZADO!");
        setLinkCodeInput("");
      } else {
        setStatus("CÓDIGO INVÁLIDO");
      }
    } catch (e) {
      console.error(e);
      setStatus("ERRO NO VÍNCULO");
    }
    setIsProcessing(false);
  };

  return (
    <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/90 p-6 animate-in fade-in backdrop-blur-sm duration-500 force-cursor" suppressHydrationWarning>
      <div className="glass-morphism border border-white/10 w-full max-w-6xl h-[92vh] p-10 shadow-[0_0_200px_rgba(0,0,0,1)] relative flex flex-col overflow-hidden rounded-sm">
        
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <Button 
          id="close-btn"
          variant="ghost" 
          onClick={onClose} 
          onMouseEnter={() => setFocusedId('close-btn')}
          className={cn(
            "absolute top-6 right-6 text-white/40 p-3 h-auto z-[210] transition-all rounded-full border border-white/5",
            focusedId === 'close-btn' ? "bg-primary scale-110 text-black border-transparent shadow-[0_0_30px_rgba(249,115,22,0.5)]" : "hover:bg-primary/10 hover:text-primary"
          )}
        >
          <X className="h-8 w-8" />
        </Button>

        <div className="flex items-center gap-6 mb-10 border-b border-white/5 pb-6 shrink-0">
          <div className="w-16 h-16 rounded-sm bg-primary/10 flex items-center justify-center border border-primary/20">
            <Settings2 className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <div>
            <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-none mb-1">
              {machineName || 'Painel do Operador'}
            </h2>
            <p className="text-primary/40 font-black uppercase text-[10px] tracking-[0.5em]">
            </p>
          </div>
          
          <div className="ml-auto flex items-center gap-4 pr-10">
            <div className={cn(
              "px-4 py-2 rounded-full border flex items-center gap-2",
              isLinkedLocally ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-orange-500/10 border-orange-500/20 text-orange-500"
            )}>
              <div className={cn("w-2 h-2 rounded-full animate-pulse", isLinkedLocally ? "bg-green-500" : "bg-orange-500")} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isLinkedLocally ? "MÁQUINA VINCULADA" : "AGUARDANDO VÍNCULO"}
              </span>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pb-10">
            
            <div className="space-y-8">
              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm space-y-6">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                  <Settings2 className="h-5 w-5" /> Configurações de Rede (Wi-Fi)
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">1. Digite a Senha</label>
                    <Input 
                      id="wifi-password"
                      type="password"
                      placeholder="SENHA DO WI-FI"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      onMouseEnter={() => setFocusedId('wifi-password')}
                      className={cn(
                        "bg-black/60 border-white/5 text-white font-mono text-center",
                        focusedId === 'wifi-password' && "border-primary ring-1 ring-primary"
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">2. Escolha a Rede</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {wifiNetworks.length === 0 ? (
                        <p className="text-[10px] text-zinc-600 italic py-4 text-center">Buscando redes...</p>
                      ) : (
                        wifiNetworks.map((net) => (
                          <button
                            key={net.ssid}
                            id={`wifi-connect-${net.ssid}`}
                            onMouseEnter={() => setFocusedId(`wifi-connect-${net.ssid}`)}
                            onClick={() => handleConnectWifi(net.ssid)}
                            className={cn(
                              "w-full flex items-center justify-between p-3 rounded-sm bg-black/40 border border-white/5 transition-all text-left",
                              focusedId === `wifi-connect-${net.ssid}` && "bg-primary text-black border-transparent scale-[1.02]"
                            )}
                          >
                            <span className="text-[10px] font-black uppercase truncate">{net.ssid}</span>
                            <div className="flex items-center gap-2">
                              {net.security !== "" && <span className="text-[8px] opacity-40">🔒</span>}
                              <span className="text-[10px] font-mono">{net.signal}%</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {wifiStatus && (
                    <div className={cn(
                      "p-3 rounded-sm text-center border font-black uppercase text-[10px] animate-in slide-in-from-bottom-2",
                      wifiStatus.startsWith('ERRO') ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-green-500/10 border-green-500/20 text-green-500"
                    )}>
                      {wifiStatus}
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm space-y-6">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                  <HardDrive className="h-5 w-5" /> USB Inteligente
                </h3>
                
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Gênero dos Novos Itens</label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENRES.map(g => (
                      <button 
                        key={g} 
                        id={`genre-select-${g}`}
                        onClick={() => { setSelectedGenre(g); setFocusedId(`genre-select-${g}`); }} 
                        onMouseEnter={() => setFocusedId(`genre-select-${g}`)}
                        className={cn(
                          "px-3 py-3 text-[10px] font-black uppercase border transition-all rounded-sm cursor-pointer",
                          selectedGenre === g 
                            ? 'bg-primary text-black border-primary shadow-[0_5px_15px_rgba(249,115,22,0.3)]' 
                            : 'bg-black/40 text-zinc-500 border-white/5 hover:border-white/10',
                          focusedId === `genre-select-${g}` && "ring-2 ring-white scale-105 z-10"
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                
                <input type="file" ref={fileInputRef} className="hidden" {...({ webkitdirectory: "", directory: "" } as any)} multiple onChange={handleSyncFolder} />
                
                <div className="grid grid-cols-1 gap-4">
                  <Button 
                    id="sync-btn"
                    disabled={isProcessing} 
                    onClick={() => { fileInputRef.current?.click(); setFocusedId('sync-btn'); }} 
                    onMouseEnter={() => setFocusedId('sync-btn')}
                    className={cn(
                      "w-full h-20 bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/20 text-sm font-black uppercase flex flex-col items-center justify-center gap-1 transition-all rounded-sm",
                      focusedId === 'sync-btn' && "ring-2 ring-white scale-[1.02] bg-primary text-black"
                    )}
                  >
                    <RefreshCw className={cn("h-5 w-5", isProcessing ? 'animate-spin' : '')} />
                    <span>Upload Normal</span>
                  </Button>

                  <Button 
                    id="sync-direct-btn"
                    disabled={isProcessing} 
                    onClick={() => { handleSyncDirectAccess(); setFocusedId('sync-direct-btn'); }} 
                    onMouseEnter={() => setFocusedId('sync-direct-btn')}
                    className={cn(
                      "w-full h-24 bg-primary text-black text-lg font-black uppercase flex flex-col items-center justify-center gap-1 transition-all rounded-sm shadow-xl",
                      focusedId === 'sync-direct-btn' && "ring-4 ring-white scale-[1.02] shadow-[0_20px_40px_rgba(249,115,22,0.4)]"
                    )}
                  >
                    <FolderTree className="h-7 w-7" />
                    <span>USB Direto (Rápido)</span>
                  </Button>
                </div>

                {status && <p className="text-center text-primary font-black uppercase text-[10px] animate-pulse leading-tight mt-2">{status}</p>}
              </section>

              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                    <DollarSign className="h-5 w-5" /> Relógio de Receita
                  </h3>
                  <Button
                    id="reset-partial-btn"
                    variant="outline"
                    size="sm"
                    onClick={() => { if(confirm("Deseja zerar o relógio parcial?")) onResetPartial(); }}
                    onMouseEnter={() => setFocusedId('reset-partial-btn')}
                    className={cn(
                      "text-[9px] font-black uppercase border-primary/20",
                      focusedId === 'reset-partial-btn' && "bg-primary text-black border-transparent"
                    )}
                  >
                    Zerar Parcial
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Relógio Parcial */}
                  <div className="bg-primary/10 p-6 border border-primary/20 rounded-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-20">
                      <RefreshCw className="h-10 w-10 text-primary rotate-12" />
                    </div>
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-primary block mb-1">Relógio Parcial</label>
                    <p className="text-4xl font-black text-white font-mono tracking-tighter mb-2">
                      R$ {(partialRevenueCash + partialRevenuePix).toFixed(2).replace('.', ',')}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase text-zinc-500">
                      <span>Dinheiro: R$ {partialRevenueCash.toFixed(2)}</span>
                      <span>PIX: R$ {partialRevenuePix.toFixed(2)}</span>
                    </div>
                    {lastResetDate && (
                      <p className="mt-4 pt-4 border-t border-primary/10 text-[9px] font-black uppercase text-primary/60 italic">
                        Zerado em: {lastResetDate}
                      </p>
                    )}
                  </div>

                  {/* Relógio Total */}
                  <div className="bg-white/5 p-6 border border-white/10 rounded-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <DollarSign className="h-10 w-10 text-white rotate-12" />
                    </div>
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 block mb-1">Relógio Total (Acumulado)</label>
                    <p className="text-4xl font-black gold-gradient-text font-mono tracking-tighter mb-2">
                      R$ {(revenueCash + revenuePix).toFixed(2).replace('.', ',')}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase text-zinc-600">
                      <span>Dinheiro: R$ {revenueCash.toFixed(2)}</span>
                      <span>PIX: R$ {revenuePix.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Valor Unitário (Música)</label>
                    <span className="text-[8px] font-black uppercase text-primary/40 italic">Ajuste com +/-</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      id="price-minus"
                      onClick={() => onUpdatePrice(Math.max(0.50, pricePerSong - 0.50))}
                      onMouseEnter={() => setFocusedId('price-minus')}
                      className={cn(
                        "w-12 h-12 bg-black/40 border border-white/5 text-white font-black text-xl hover:bg-primary/20 hover:border-primary transition-all rounded-sm",
                        focusedId === 'price-minus' && "bg-primary text-black border-transparent scale-105"
                      )}
                    >
                      -
                    </Button>
                    <div className="flex-1 bg-black/60 border border-white/5 h-12 flex items-center justify-center rounded-sm">
                      <span className="text-primary text-2xl font-black font-mono">R$ {pricePerSong.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <Button 
                      id="price-plus"
                      onClick={() => onUpdatePrice(pricePerSong + 0.50)}
                      onMouseEnter={() => setFocusedId('price-plus')}
                      className={cn(
                        "w-12 h-12 bg-black/40 border border-white/5 text-white font-black text-xl hover:bg-primary/20 hover:border-primary transition-all rounded-sm",
                        focusedId === 'price-plus' && "bg-primary text-black border-transparent scale-105"
                      )}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </section>

              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm space-y-6">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                  <RefreshCw className={cn("h-5 w-5", randomPlayEnabled ? "animate-spin-slow" : "")} /> Chama Clientes
                </h3>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-sm">
                    <div>
                      <p className="text-[11px] font-black uppercase text-white">Música Aleatória</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase">Toca uma música a cada intervalo</p>
                    </div>
                    <button
                      id="random-play-toggle"
                      onClick={() => onUpdateRandomPlay(!randomPlayEnabled, randomPlayInterval)}
                      onMouseEnter={() => setFocusedId('random-play-toggle')}
                      className={cn(
                        "w-14 h-8 rounded-full transition-all relative border",
                        randomPlayEnabled ? "bg-primary border-primary" : "bg-zinc-800 border-white/10",
                        focusedId === 'random-play-toggle' && "ring-2 ring-white"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-5 h-5 rounded-full transition-all bg-white",
                        randomPlayEnabled ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Intervalo de Chamada</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[15, 30, 60].map((min) => (
                        <button
                          key={min}
                          id={`random-interval-${min}`}
                          onClick={() => onUpdateRandomPlay(true, min)}
                          onMouseEnter={() => setFocusedId(`random-interval-${min}`)}
                          className={cn(
                            "py-3 text-[10px] font-black uppercase border transition-all rounded-sm",
                            randomPlayEnabled && randomPlayInterval === min
                              ? "bg-primary text-black border-primary"
                              : "bg-black/40 text-zinc-500 border-white/5",
                            focusedId === `random-interval-${min}` && "ring-2 ring-white scale-105"
                          )}
                        >
                          {min} MIN
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm">
                    <p className="text-[9px] text-primary/60 font-black uppercase leading-tight text-center">
                      A música aleatória só será tocada se a máquina estiver ociosa e não houver pedidos na fila.
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm space-y-6">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                  <Star className="h-5 w-5" /> Configuração de Bônus
                </h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {['5', '10', '20', '50'].map((val) => (
                      <div 
                        key={val}
                        id={`bonus-${val}`}
                        onMouseEnter={() => setFocusedId(`bonus-${val}`)}
                        onClick={() => {
                          const current = bonusConfig[val] || 0;
                          onUpdateBonusConfig({ ...bonusConfig, [val]: current + 1 });
                        }}
                        className={cn(
                          "flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-sm transition-all",
                          focusedId === `bonus-${val}` && "bg-primary/20 border-primary scale-[1.02]"
                        )}
                      >
                        <div>
                          <p className="text-[10px] font-black uppercase text-zinc-500">Ao pagar R$ {val},00</p>
                          <p className="text-[11px] font-black uppercase text-white">Ganha bônus de:</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-2xl font-black text-primary font-mono">+{bonusConfig[val] || 0}</span>
                            <span className="text-[8px] font-black uppercase text-primary/40 block">Músicas</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button 
                              className="w-6 h-6 bg-white/5 hover:bg-white/10 flex items-center justify-center rounded-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = bonusConfig[val] || 0;
                                onUpdateBonusConfig({ ...bonusConfig, [val]: current + 1 });
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button 
                              className="w-6 h-6 bg-white/5 hover:bg-white/10 flex items-center justify-center rounded-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = bonusConfig[val] || 0;
                                onUpdateBonusConfig({ ...bonusConfig, [val]: Math.max(0, current - 1) });
                              }}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-sm">
                    <p className="text-[9px] text-primary/80 font-black uppercase leading-tight">
                      DICA: O bônus é somado aos créditos normais. <br/>
                      Ex: Se o preço é R$ 1,00 e o bônus para R$ 5,00 é +2, o cliente receberá 7 músicas no total (5 padrão + 2 bônus).
                    </p>
                  </div>
                </div>
              </section>


              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm space-y-6">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                  <Film className="h-5 w-5" /> Vídeos de Fundo
                </h3>
                
                <div className="space-y-4">
                  <input
                    type="file"
                    ref={videoInputRef}
                    onChange={handleVideoUpload}
                    accept="video/mp4,video/webm"
                    multiple
                    className="hidden"
                  />
                  
                  <button
                    id="upload-video-btn"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isProcessing}
                    onMouseEnter={() => setFocusedId('upload-video-btn')}
                    className={cn(
                      "w-full py-4 border-2 border-dashed border-primary/30 rounded-sm font-black uppercase text-xs flex items-center justify-center gap-2 transition-all hover:bg-primary/10 hover:border-primary",
                      focusedId === 'upload-video-btn' && "bg-primary text-black border-primary scale-[1.02]"
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Vídeo de Fundo
                  </button>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {visualizers.map((v) => (
                      <div 
                        key={v.id} 
                        id={`video-del-${v.id}`}
                        onMouseEnter={() => setFocusedId(`video-del-${v.id}`)}
                        className={cn(
                          "flex items-center justify-between gap-4 p-3 bg-black/40 border border-white/5 rounded-sm group transition-all",
                          focusedId === `video-del-${v.id}` && "bg-red-500/10 border-red-500/50"
                        )}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Film className="h-3 w-3 text-zinc-500" />
                          <span className="text-[10px] font-bold text-zinc-400 truncate uppercase">{v.name}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteVideo(v.id)}
                          className="text-red-500/50 hover:text-red-500 p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {visualizers.length === 0 && (
                      <p className="text-center py-10 text-[10px] text-zinc-800 font-bold uppercase tracking-[0.2em] border border-dashed border-white/5">Nenhum vídeo customizado</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm space-y-6">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                  <CreditCard className="h-5 w-5" /> Config. Mercado Pago
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 block mb-2">Máquina Autenticada</label>
                    <div className="bg-black/60 border border-white/5 text-white/40 text-[10px] font-mono h-12 px-4 flex items-center rounded-sm">
                      {machineId}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                       <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Access Token</label>
                       <span className="text-[8px] font-black uppercase text-primary/40">ADM Somente</span>
                    </div>
                    <div className="bg-black/60 border border-white/5 text-white/20 text-[10px] h-12 px-4 flex items-center rounded-sm font-mono truncate">
                      {mpAccessToken ? "••••••••••••••••" : "Não Configurado"}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm">
                    <p className="text-[9px] text-primary/60 font-black uppercase leading-tight text-center">
                      Configurações financeiras e APIs são gerenciadas remotamente através do Painel Administrativo por segurança.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <Button
                      id="logout-btn"
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Deseja realmente sair da conta nesta máquina?")) {
                          onLogout();
                        }
                      }}
                      onMouseEnter={() => setFocusedId('logout-btn')}
                      className={cn(
                          "w-full h-12 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[11px] font-black uppercase rounded-sm border border-red-500/20 transition-all gap-2",
                          focusedId === 'logout-btn' && "ring-4 ring-white scale-[1.02] bg-red-500 text-white"
                      )}
                    >
                      <LogOut className="h-4 w-4" />
                      Sair da Conta (Logout)
                    </Button>
                  </div>
                </div>
              </section>

              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm space-y-6">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                  <Smartphone className="h-5 w-5" /> Vínculo com a Nuvem
                </h3>
                
                <div className="space-y-4">
                  {!isLinkedLocally ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Digite o Código do Painel</label>
                        <div className="flex gap-2">
                          <Input 
                            id="link-code-input"
                            placeholder="EX: JUKE-1234"
                            value={linkCodeInput}
                            onChange={(e) => setLinkCodeInput(e.target.value.toUpperCase())}
                            onMouseEnter={() => setFocusedId('link-code-input')}
                            className={cn(
                              "bg-black/60 border-white/5 text-white font-mono text-center flex-1",
                              focusedId === 'link-code-input' && "border-primary ring-1 ring-primary"
                            )}
                          />
                          <Button 
                            id="link-code-btn"
                            onClick={handleManualLink}
                            onMouseEnter={() => setFocusedId('link-code-btn')}
                            className={cn(
                              "bg-primary text-black font-black uppercase text-[10px]",
                              focusedId === 'link-code-btn' && "scale-105 shadow-[0_0_20px_rgba(249,115,22,0.4)]"
                            )}
                          >
                            Vincular
                          </Button>
                        </div>
                      </div>
                      <p className="text-[8px] text-zinc-600 font-bold uppercase leading-tight italic">
                        * O código é gerado no Painel ADM (Web) após criar uma "Máquina Shell".
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-4 border border-dashed border-green-500/20 bg-green-500/5 rounded-sm">
                       <Star className="h-8 w-8 text-green-500 animate-spin-slow" />
                       <p className="text-[10px] text-green-500 font-black uppercase tracking-widest">Sincronizado com o Servidor</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase mb-2">Painel de Controle Remoto:</p>
                    <div className="bg-black/40 p-4 border border-white/5 rounded-sm flex items-center justify-between">
                       <span className="text-primary font-mono text-xs">www.jukeboxmusica.com/admin</span>
                       <CreditCard className="h-4 w-4 text-primary/40" />
                    </div>
                  </div>
                </div>
              </section>
            </div>


            <div className="space-y-8">
              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm space-y-6">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                  <KeyboardIcon className="h-5 w-5" /> Mapeamento de Teclas
                </h3>
                
                <p className="text-[10px] text-zinc-500 font-bold uppercase leading-tight">
                  Clique no botão da função e pressione a tecla física correspondente para mapear.
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: 'Cima', action: 'KEY_UP' },
                    { label: 'Baixo', action: 'KEY_DOWN' },
                    { label: 'Esquerda', action: 'KEY_LEFT' },
                    { label: 'Direita', action: 'KEY_RIGHT' },
                    { label: 'Confirmar (Menu)', action: 'KEY_SELECT' },
                    { label: 'Escolher Disco', action: 'KEY_CHOOSE_ALBUM' },
                    { label: 'Tocar Música', action: 'KEY_PLAY_TRACK' },
                    { label: 'Voltar / Esc', action: 'KEY_BACK' },
                    { label: 'Alternar Barra Volume', action: 'KEY_VOL_CONTROL' },
                    { label: 'Aumentar Volume', action: 'KEY_VOL_UP' },
                    { label: 'Diminuir Volume', action: 'KEY_VOL_DOWN' },
                    { label: 'Inserir Crédito', action: 'KEY_CREDIT' },
                    { label: 'Abrir PIX', action: 'KEY_PIX' },
                    { label: 'Abrir Menu', action: 'KEY_MENU' },
                  ].map((item) => (
                    <div key={item.action} className="flex items-center justify-between gap-4 p-2 bg-black/40 border border-white/5 rounded-sm">
                      <span className="text-[11px] font-black uppercase text-zinc-400">{item.label}</span>
                      <Button
                        id={`map-${item.action}`}
                        onClick={() => { setRecordingAction(item.action); setStatus("AGUARDANDO TECLA..."); }}
                        onMouseEnter={() => setFocusedId(`map-${item.action}`)}
                        className={cn(
                          "min-w-24 h-10 text-[11px] font-black uppercase transition-all rounded-sm",
                          recordingAction === item.action 
                            ? "bg-primary text-black animate-pulse scale-110 shadow-[0_0_20px_rgba(249,115,22,0.5)]" 
                            : (focusedId === `map-${item.action}` ? "bg-white/10 text-primary border-primary" : "bg-white/5 text-zinc-500")
                        )}
                      >
                        {recordingAction === item.action ? '???' : keyMappings[item.action]?.toUpperCase() || 'N/A'}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <MousePointer2 className="h-4 w-4 text-primary" />
                    <p className="text-[10px] text-primary font-black uppercase">Dica do Mouse</p>
                  </div>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase leading-tight">
                    Algumas teclas como Windows ou Alt podem não ser capturadas dependendo do sistema operacional.
                  </p>
                </div>
              </section>

              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm h-full">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3 mb-8">
                  <Ban className="h-5 w-5" /> Bloquear Gêneros
                </h3>
                <div className="space-y-3">
                  {GENRES.map(genre => {
                    const isHidden = hiddenGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        id={`toggle-genre-${genre}`}
                        onClick={() => { toggleGenreVisibility(genre); setFocusedId(`toggle-genre-${genre}`); }}
                        onMouseEnter={() => setFocusedId(`toggle-genre-${genre}`)}
                        className={cn(
                          "w-full flex items-center justify-between p-5 rounded-sm border transition-all cursor-pointer",
                          isHidden
                            ? 'bg-red-500/10 border-red-500/30 text-red-500'
                            : 'bg-black/40 border-white/5 text-zinc-400 hover:bg-white/5',
                          focusedId === `toggle-genre-${genre}` && "border-white ring-1 ring-white scale-[1.02]"
                        )}
                      >
                        <span className="font-black uppercase tracking-[0.2em] text-[11px]">{genre}</span>
                        <div className={cn("w-6 h-6 rounded-full border flex items-center justify-center", isHidden ? "bg-red-500 border-red-500" : "border-white/10")}>
                          {isHidden && <X className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>


            <div className="space-y-8">
              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black uppercase text-primary">Biblioteca</h3>
                    <div className="flex gap-3">
                      <button id="clear-viz" onClick={() => { if(confirm("Limpar backgrounds?")) { clearVisualizers().then(onVisualizersUpdated); }}} onMouseEnter={() => setFocusedId('clear-viz')} className={cn("w-10 h-10 flex items-center justify-center rounded-sm border border-white/5 text-zinc-500 transition-all cursor-pointer", focusedId === 'clear-viz' && "bg-primary text-black border-transparent")}>
                        <Video className="h-4 w-4" />
                      </button>
                      <button id="clear-lib" onClick={() => { if(confirm("Limpar biblioteca completa?")) { albums.forEach(a => onDeleteAlbum(a.id)); clearVisualizers().then(onVisualizersUpdated); }}} onMouseEnter={() => setFocusedId('clear-lib')} className={cn("w-10 h-10 flex items-center justify-center rounded-sm border border-white/5 text-red-500/50 transition-all cursor-pointer", focusedId === 'clear-lib' && "bg-red-500 text-white border-transparent")}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3 max-h-[440px] overflow-auto pr-3 -mr-3">
                    {albums.length === 0 ? (
                      <div className="text-center py-20 border border-dashed border-white/5 rounded-sm">
                        <HardDrive className="h-10 w-10 text-white/5 mx-auto mb-4" />
                        <p className="text-zinc-600 font-black uppercase text-[9px] tracking-[0.3em]">Vazio</p>
                      </div>
                    ) : (
                      albums.map(album => (
                        <div key={album.id} id={`album-del-${album.id}`} onMouseEnter={() => setFocusedId(`album-del-${album.id}`)} onClick={() => setFocusedId(`album-del-${album.id}`)} className={cn("flex items-center justify-between p-4 bg-black/60 border border-white/5 rounded-sm transition-all hover:bg-white/5", focusedId === `album-del-${album.id}` && "border-primary ring-1 ring-primary")}>
                          <div className="flex-1 truncate pr-4">
                            <p className="text-white font-black uppercase text-[10px] truncate">{album.title}</p>
                            <p className="text-zinc-600 font-bold uppercase text-[8px]">{album.isDirectAccess ? "USB Direto" : album.genre}</p>
                          </div>
                          <button onClick={() => onDeleteAlbum(album.id)} className="p-2 text-zinc-700 hover:text-red-500 cursor-pointer">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
               </section>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};