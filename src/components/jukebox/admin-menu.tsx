"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Album, Track, GENRES } from '@/lib/jukebox-data';
import { X, HardDrive, DollarSign, Ban, Settings2, Trash2, RefreshCw, Video, FolderTree, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { saveVisualizers, clearVisualizers, saveUSBHandle } from '@/lib/db';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useFirestore } from '@/firebase/provider';
import { doc, onSnapshot } from 'firebase/firestore';

interface AdminMenuProps {
  onClose: () => void;
  onAddAlbumsBulk: (albums: Album[]) => void;
  onDeleteAlbum: (id: string) => void;
  albums: Album[];
  pricePerSong: number;
  setPricePerSong: (price: number) => void;
  revenueCash: number;
  revenuePix: number;
  hiddenGenres: string[];

  setHiddenGenres: (genres: string[]) => void;
  visualizerCount: number;
  onVisualizersUpdated: () => void;
  mpAccessToken: string;
  setMpAccessToken: (token: string) => void;
  machineId: string;
  setMachineId: (id: string) => void;
}

type FocusableId = 'close-btn' | 'sync-btn' | 'sync-direct-btn' | 'price-input' | 'mp-token-input' | 'machine-id-input' | 'clear-lib' | 'clear-viz' | string;

export const AdminMenu: React.FC<AdminMenuProps> = ({ 
  onClose, 
  onAddAlbumsBulk,
  onDeleteAlbum,
  albums,
  pricePerSong, 
  setPricePerSong, 
  revenueCash,
  revenuePix,
  hiddenGenres,

  setHiddenGenres,
  visualizerCount,
  onVisualizersUpdated,
  mpAccessToken,
  setMpAccessToken,
  machineId,
  setMachineId
}) => {
  const firestore = useFirestore();
  const [machineName, setMachineName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
  const [focusedId, setFocusedId] = useState<FocusableId>('sync-btn');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!firestore || !machineId) return;
    const unsub = onSnapshot(doc(firestore, 'machines', machineId), (docSnap) => {
      if (docSnap.exists()) {
        setMachineName(docSnap.data().name || null);
      }
    });
    return () => unsub();
  }, [firestore, machineId]);

  const focusableSequence: FocusableId[] = [
    'close-btn',
    ...GENRES.map(g => `genre-select-${g}`),
    'sync-btn',
    'sync-direct-btn',
    'price-input',
    'mp-token-input',
    'machine-id-input',
    'mp-save-btn',
    'clear-lib',
    'clear-viz',
    ...GENRES.map(g => `genre-toggle-${g}`),
    ...albums.map(a => `album-del-${a.id}`)
  ];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentIndex = focusableSequence.indexOf(focusedId);
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedId(focusableSequence[(currentIndex + 1) % focusableSequence.length]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedId(focusableSequence[(currentIndex - 1 + focusableSequence.length) % focusableSequence.length]);
        break;
      case 'Enter':
        if (focusedId === 'sync-btn') {
          fileInputRef.current?.click();
        } else if (focusedId === 'sync-direct-btn') {
          handleSyncDirectAccess();
        } else if (focusedId === 'mp-save-btn') {
          handleSaveConfig();
        }
        break;
      case 'Escape':
      case 'Backspace':
        if (!isProcessing) onClose();
        break;
    }
  }, [focusedId, focusableSequence, isProcessing, onClose]);

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
      setHiddenGenres(hiddenGenres.filter(g => g !== genre));
    } else {
      setHiddenGenres([...hiddenGenres, genre]);
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
      const visualizers = visualizerFiles.map(f => ({
        id: `viz-${f.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: f.name,
        file: f
      }));
      await saveVisualizers(visualizers);
      onVisualizersUpdated();
    }

    if (albumsToBatch.length > 0) {
      onAddAlbumsBulk(albumsToBatch);
      setStatus(`OK: ${albumsToBatch.length} Álbuns (${albumsWithCover} com capa)`);
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

      for (const item of allFiles) {
        const { file, path } = item;
        const name = file.name.toLowerCase();
        if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
          allImages.push({ file, path });
        }
        if (path.toLowerCase().includes('backgrounds')) continue;

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
            allFiles.push({ name: file.name, path: fullPath });
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

  return (
    <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/90 p-6 animate-in fade-in backdrop-blur-sm duration-500" suppressHydrationWarning>
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
              {machineName ? `Painel Local - ID: ${machineId.slice(0, 8)}` : 'Gerenciamento de Sistema & Configurações'}
            </p>
          </div>
        </div>

        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10">
            
            <div className="space-y-8">
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
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                  <DollarSign className="h-5 w-5" /> Finanças
                </h3>
                <div className="space-y-5">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 block mb-3">Valor por Música</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 font-black text-lg">R$</span>
                      <Input 
                        id="price-input"
                        type="number" 
                        step="0.10" 
                        value={pricePerSong} 
                        onChange={(e) => setPricePerSong(Number(e.target.value))} 
                        onFocus={() => setFocusedId('price-input')}
                        className={cn(
                          "bg-black/60 border-white/5 text-primary text-3xl font-black font-mono h-16 pl-12 text-center transition-all rounded-sm cursor-text",
                          focusedId === 'price-input' && "border-white ring-1 ring-white"
                        )} 
                      />
                    </div>
                  </div>
                  <div className="bg-primary/5 p-6 border border-primary/20 rounded-sm overflow-hidden relative space-y-4">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 block mb-1">Arrecadação em Espécie</label>
                      <p className="text-2xl font-black text-white font-mono tracking-tighter">
                        R$ {revenueCash.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-white/5">
                      <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 block mb-1">Arrecadação em PIX</label>
                      <p className="text-2xl font-black text-primary font-mono tracking-tighter">
                        R$ {revenuePix.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-primary/20 bg-primary/10 -mx-6 px-6 pb-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60 block mb-1">Total Geral</label>
                      <p className="text-4xl font-black gold-gradient-text font-mono tracking-tighter">
                        R$ {(revenueCash + revenuePix).toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>

                </div>
              </section>

              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm space-y-6">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                  <CreditCard className="h-5 w-5" /> Config. Mercado Pago
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 block mb-2">ID Único da Máquina (PDV)</label>
                    <Input 
                      id="machine-id-input"
                      value={machineId} 
                      onChange={(e) => setMachineId(e.target.value.toUpperCase())} 
                      onFocus={() => setFocusedId('machine-id-input')}
                      onMouseEnter={() => setFocusedId('machine-id-input')}
                      className={cn(
                        "bg-black/60 border-white/5 text-white text-xs font-black h-12 px-4 transition-all rounded-sm",
                        focusedId === 'machine-id-input' && "border-white ring-1 ring-white"
                      )} 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 block mb-2">Access Token</label>
                    <Input 
                      id="mp-token-input"
                      type="password"
                      placeholder="APP_USR-..." 
                      value={mpAccessToken} 
                      onChange={(e) => setMpAccessToken(e.target.value)} 
                      onFocus={() => setFocusedId('mp-token-input')}
                      onMouseEnter={() => setFocusedId('mp-token-input')}
                      className={cn(
                        "bg-black/60 border-white/5 text-white text-[10px] h-12 px-4 transition-all rounded-sm font-mono",
                        focusedId === 'mp-token-input' && "border-white ring-1 ring-white"
                      )} 
                    />
                  </div>
                  <Button
                    id="mp-save-btn"
                    onClick={() => {
                        handleSaveConfig();
                        setFocusedId('mp-save-btn');
                    }}
                    onMouseEnter={() => setFocusedId('mp-save-btn')}
                    className={cn(
                        "w-full h-12 bg-primary/20 hover:bg-primary text-primary hover:text-black text-[11px] font-black uppercase rounded-sm border border-primary/20 transition-all shadow-lg",
                        focusedId === 'mp-save-btn' && "ring-4 ring-white scale-[1.02] bg-primary text-black"
                    )}
                  >
                    Salvar Configurações
                  </Button>
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section className="bg-white/5 backdrop-blur-md p-8 border border-white/5 rounded-sm h-full">
                <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3 mb-8">
                  <Ban className="h-5 w-5" /> Bloquear Gêneros
                </h3>
                <div className="space-y-3">
                  {GENRES.map(genre => {
                    const isHidden = hiddenGenres.includes(genre);
                    const isFocused = focusedId === `genre-toggle-${genre}`;
                    return (
                      <button 
                        key={genre} 
                        id={`genre-toggle-${genre}`}
                        onClick={() => { toggleGenreVisibility(genre); setFocusedId(`genre-toggle-${genre}`); }} 
                        onMouseEnter={() => setFocusedId(`genre-toggle-${genre}`)}
                        className={cn(
                          "w-full flex items-center justify-between p-5 rounded-sm border transition-all cursor-pointer",
                          isHidden 
                            ? 'bg-red-500/10 border-red-500/30 text-red-500' 
                            : 'bg-black/40 border-white/5 text-zinc-400 hover:bg-white/5',
                          isFocused && "border-white ring-1 ring-white scale-[1.02]"
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