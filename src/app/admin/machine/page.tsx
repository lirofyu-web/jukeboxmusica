'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Upload, Trash2, FolderUp, Music, 
  Link2, CheckCircle2, AlertCircle, Loader2, Clock,
  ListMusic, CloudUpload, Sparkles, Eraser, RefreshCw
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  createdAt: any;
  status?: string;
  albumTitle?: string;
}

const StatusIcon = ({ status }: { status?: string }) => {
  if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
  if (status === 'downloading') return <Loader2 className="w-3.5 h-3.5 text-blue-400 shrink-0 animate-spin" />;
  if (status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
};

const statusLabel = (status?: string) => {
  if (status === 'completed') return 'Baixado';
  if (status === 'downloading') return 'Baixando...';
  if (status === 'failed') return 'Falhou (Link Quebrado/CORS)';
  return 'Pendente';
};

export default function MachineAdminPage({ searchParams }: { searchParams: Promise<{ id: string }> }) {
  const { id: machineId } = use(searchParams);
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [machineName, setMachineName] = useState<string>('');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingCompleted, setClearingCompleted] = useState(false);

  // Upload States
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Link States
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Fetch machine name
  useEffect(() => {
    if (!firestore || !machineId) return;
    getDoc(doc(firestore, 'machines', machineId)).then(snap => {
      if (snap.exists()) setMachineName(snap.data()?.name || '');
    });
  }, [firestore, machineId]);

  // Realtime track listener
  useEffect(() => {
    if (!firestore || !machineId) return;
    const q = query(collection(firestore, `machines/${machineId}/music_commands`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const currentTracks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MusicTrack));
      setTracks(currentTracks);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [firestore, machineId]);

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!firestore) return;

    setUploading(true);
    setProgress(0);
    const allFiles = Array.from(files);
    const audioFiles = allFiles.filter(f => 
      f.type.startsWith('audio/') || 
      f.type.startsWith('video/') || 
      f.name.toLowerCase().endsWith('.mp3') || 
      f.name.toLowerCase().endsWith('.mp4')
    );
    
    if (audioFiles.length === 0) {
      toast({ title: 'Aviso', description: 'Nenhum arquivo de mídia (MP3/MP4) encontrado.', variant: 'destructive' });
      setUploading(false);
      return;
    }

    const groups: Record<string, { audio: File[], image?: File }> = {};
    
    for (const file of allFiles) {
      const pathParts = (file as any).webkitRelativePath?.split('/') || [];
      const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;
      
      if (folderName) {
        if (!groups[folderName]) groups[folderName] = { audio: [] };
        const isMedia = file.type.startsWith('audio/') || file.type.startsWith('video/') || 
                        file.name.toLowerCase().endsWith('.mp3') || file.name.toLowerCase().endsWith('.mp4');
        
        if (isMedia) {
          groups[folderName].audio.push(file);
        } else if (file.type.startsWith('image/')) {
          const name = file.name.toLowerCase();
          if (!groups[folderName].image || name.includes('cover') || name.includes('folder') || name.includes('capa')) {
            groups[folderName].image = file;
          }
        }
      }
    }

    let completed = 0;
    const totalToUpload = audioFiles.length;

    // Process Grouped Folders
    for (const folderName of Object.keys(groups)) {
      const group = groups[folderName];
      if (group.audio.length === 0) continue;

      let folderCoverUrl = '';
      if (group.image) {
        try {
          const storage = getStorage();
          const imgRef = ref(storage, `machines/${machineId}/uploads/${folderName}/cover_${group.image.name}`);
          await uploadBytesResumable(imgRef, group.image);
          folderCoverUrl = await getDownloadURL(imgRef);
        } catch (e) { console.error("Falha ao subir capa da pasta", e); }
      }

      for (const file of group.audio) {
        setCurrentFileName(`${folderName}/${file.name}`);
        try {
          const storage = getStorage();
          const storageRef = ref(storage, `machines/${machineId}/uploads/${folderName}/${file.name}`);
          
          await new Promise<void>((resolve, reject) => {
            const uploadTask = uploadBytesResumable(storageRef, file);
            uploadTask.on('state_changed', null, (error) => reject(error), () => resolve());
          });
          
          const downloadUrl = await getDownloadURL(storageRef);
          
          await addDoc(collection(firestore, `machines/${machineId}/music_commands`), {
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Pasta Upload',
            url: downloadUrl,
            albumTitle: folderName,
            albumCover: folderCoverUrl,
            command: 'DOWNLOAD_TRACK',
            status: 'pending',
            createdAt: serverTimestamp(),
          });
          completed++;
          setProgress((completed / totalToUpload) * 100);
        } catch (err: any) {
          toast({ title: 'Erro', description: `Falha em ${file.name}`, variant: 'destructive' });
        }
      }
    }

    // Process Loose Files
    const groupedFileNames = new Set(Object.values(groups).flatMap(g => g.audio.map(f => f.name)));
    const looseFiles = audioFiles.filter(f => !groupedFileNames.has(f.name));

    for (const file of looseFiles) {
      setCurrentFileName(file.name);
      try {
        const storage = getStorage();
        const storageRef = ref(storage, `machines/${machineId}/uploads/loose_files/${file.name}`);
        
        await new Promise<void>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(storageRef, file);
          uploadTask.on('state_changed', null, (error) => reject(error), () => resolve());
        });
        
        const downloadUrl = await getDownloadURL(storageRef);
        
        await addDoc(collection(firestore, `machines/${machineId}/music_commands`), {
          title: file.name.replace(/\.[^/.]+$/, ""),
          artist: 'Avulsa',
          url: downloadUrl,
          command: 'DOWNLOAD_TRACK',
          status: 'pending',
          createdAt: serverTimestamp(),
        });
        completed++;
        setProgress((completed / totalToUpload) * 100);
      } catch (err: any) {
        toast({ title: 'Erro', description: `Falha em ${file.name}`, variant: 'destructive' });
      }
    }
    
    setUploading(false);
    setProgress(0);
    setCurrentFileName('');
    toast({ title: 'Sucesso!', description: `${completed} músicas enviadas.` });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const convertSharedLink = (url: string) => {
    const gDriveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gDriveMatch && gDriveMatch[1]) {
      return `https://drive.google.com/uc?export=download&confirm=t&id=${gDriveMatch[1]}`;
    }
    if (url.includes('dropbox.com')) {
      try {
        const dropboxUrl = new URL(url);
        dropboxUrl.searchParams.set('dl', '1');
        return dropboxUrl.toString();
      } catch (e) { return url; }
    }
    return url;
  };

  const handleAddLink = async () => {
    if (!newTitle.trim() || !newUrl.trim()) {
      toast({ title: 'Aviso', description: 'Preencha o título e o link.', variant: 'destructive' });
      return;
    }
    if (!firestore) return;

    const directUrl = convertSharedLink(newUrl);
    try {
      await addDoc(collection(firestore, `machines/${machineId}/music_commands`), {
        title: newTitle.trim(),
        artist: 'Artista Desconhecido',
        url: directUrl,
        command: 'DOWNLOAD_TRACK',
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setNewTitle('');
      setNewUrl('');
      toast({ title: 'Sucesso', description: 'Comando enviado para a Jukebox!' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteCommand = async (trackId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, `machines/${machineId}/music_commands`, trackId));
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleClearCompleted = async () => {
    if (!firestore) return;
    const completed = tracks.filter(t => t.status === 'completed');
    if (completed.length === 0) {
      toast({ title: 'Nada para limpar', description: 'Não há itens concluídos na fila.' });
      return;
    }
    setClearingCompleted(true);
    try {
      const batch = writeBatch(firestore);
      completed.forEach(t => {
        batch.delete(doc(firestore, `machines/${machineId}/music_commands`, t.id));
      });
      await batch.commit();
      toast({ title: 'Limpo!', description: `${completed.length} item(ns) concluído(s) removido(s).` });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setClearingCompleted(false);
    }
  };

  const handleDeleteMachine = async () => {
    if (!firestore || !machineId) return;
    if (!confirm("DESEJA EXCLUIR DEFINITIVAMENTE ESTA MÁQUINA E TODA SUA FILA?")) return;
    try {
      await deleteDoc(doc(firestore, 'machines', machineId));
      toast({ title: 'Sucesso', description: 'Máquina excluída!' });
      window.location.href = '/admin';
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const completedCount = tracks.filter(t => t.status === 'completed').length;
  const pendingCount = tracks.filter(t => t.status === 'pending').length;
  const failedCount = tracks.filter(t => t.status === 'failed').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-white/5">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="w-10 h-10 bg-white/5 border border-white/5 hover:bg-white/10 rounded-sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">Gerenciamento de Música</p>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white truncate">
            {machineName || <span className="text-zinc-600 animate-pulse">Carregando...</span>}
          </h2>
          <p className="text-[10px] font-mono text-zinc-700 mt-1">{machineId}</p>
        </div>
        
        {/* Queue Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-sm px-3 py-2">
            <ListMusic className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs font-black text-zinc-400">{tracks.length} na fila</span>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleDeleteMachine} 
            className="bg-red-600/10 hover:bg-red-700 border border-red-600/30 text-red-400 hover:text-white font-black uppercase text-[10px] h-10 px-4 gap-2 transition-all rounded-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Excluir Máquina</span>
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Upload Panel */}
        <div className="group relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-orange-600/30 rounded-sm blur opacity-0 group-hover:opacity-30 transition duration-500" />
          <div className="relative bg-zinc-900/60 backdrop-blur-xl border border-white/5 rounded-sm overflow-hidden">
            
            {/* Panel Header */}
            <div className="p-6 border-b border-white/5 flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-sm flex items-center justify-center">
                <CloudUpload className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Enviar Músicas</h3>
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Upload para Firebase Storage</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Upload Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="group/btn flex flex-col items-center justify-center gap-2 p-5 bg-white/3 hover:bg-white/5 border border-white/5 hover:border-primary/20 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Music className="w-6 h-6 text-zinc-500 group-hover/btn:text-primary transition-colors" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 group-hover/btn:text-zinc-300 transition-colors">Arquivos .mp3</span>
                </button>

                <button
                  onClick={() => folderInputRef.current?.click()}
                  disabled={uploading}
                  className="group/btn flex flex-col items-center justify-center gap-2 p-5 bg-white/3 hover:bg-white/5 border border-white/5 hover:border-indigo-500/20 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderUp className="w-6 h-6 text-zinc-500 group-hover/btn:text-indigo-400 transition-colors" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 group-hover/btn:text-zinc-300 transition-colors">Pasta Inteira</span>
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">ou por link</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* Link Section */}
              <div className="space-y-3">
                <div className="relative">
                  <Music className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                  <Input
                    placeholder="Título da Música..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="bg-black/30 border-white/5 focus:border-primary/30 pl-9 h-11 text-sm font-medium placeholder:text-zinc-700"
                    disabled={uploading}
                  />
                </div>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                  <Input
                    placeholder="Link Google Drive ou Dropbox..."
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="bg-black/30 border-white/5 focus:border-primary/30 pl-9 h-11 text-sm font-medium placeholder:text-zinc-700"
                    disabled={uploading}
                  />
                </div>
                <Button 
                  onClick={handleAddLink} 
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest gap-2 transition-all rounded-sm" 
                  disabled={uploading || !newTitle.trim() || !newUrl.trim()}
                >
                  <Sparkles className="w-4 h-4" />
                  Enviar Link para a Máquina
                </Button>
              </div>

              {/* Hidden file inputs */}
              <input 
                type="file" multiple accept="audio/*" ref={fileInputRef} className="hidden" 
                onChange={(e) => processFiles(e.target.files)} 
              />
              <input 
                type="file" 
                // @ts-ignore
                webkitdirectory="true" directory="true" ref={folderInputRef} className="hidden" 
                onChange={(e) => processFiles(e.target.files)} 
              />

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-3 p-4 rounded-sm bg-primary/5 border border-primary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">Enviando...</span>
                    </div>
                    <span className="text-[10px] font-black text-primary">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-[9px] text-zinc-600 font-bold truncate">📂 {currentFileName}</p>
                  <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest text-center">⚠ Não feche esta página</p>
                </div>
              )}

              {!uploading && (
                <p className="text-[9px] text-zinc-700 text-center font-bold leading-relaxed">
                  Os arquivos são salvos no Firebase Storage e baixados automaticamente pela máquina.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Queue Panel */}
        <div className="group relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 rounded-sm blur opacity-0 group-hover:opacity-30 transition duration-500" />
          <div className="relative bg-zinc-900/60 backdrop-blur-xl border border-white/5 rounded-sm overflow-hidden flex flex-col" style={{ minHeight: '500px', maxHeight: '700px' }}>
            
            {/* Panel Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/20 rounded-sm flex items-center justify-center">
                  <ListMusic className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Fila de Downloads</h3>
                  {/* Status Counters */}
                  <div className="flex items-center gap-2 mt-0.5">
                    {completedCount > 0 && (
                      <span className="text-[8px] font-black text-green-500 uppercase">{completedCount} baixado{completedCount > 1 ? 's' : ''}</span>
                    )}
                    {pendingCount > 0 && (
                      <span className="text-[8px] font-black text-amber-500 uppercase">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
                    )}
                    {failedCount > 0 && (
                      <span className="text-[8px] font-black text-red-500 uppercase">{failedCount} falho{failedCount > 1 ? 's' : ''}</span>
                    )}
                    {tracks.length === 0 && (
                      <span className="text-[8px] font-black text-zinc-600 uppercase">Fila vazia</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Clear Completed Button */}
              {completedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCompleted}
                  disabled={clearingCompleted}
                  className="h-8 px-3 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-green-400 hover:bg-green-500/5 border border-transparent hover:border-green-500/10 transition-all gap-1.5"
                >
                  {clearingCompleted ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Eraser className="w-3 h-3" />
                  )}
                  Limpar ({completedCount})
                </Button>
              )}
            </div>

            {/* Track List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3 text-zinc-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-black uppercase tracking-widest">Carregando...</span>
                  </div>
                </div>
              ) : tracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <ListMusic className="w-8 h-8 text-zinc-800" />
                  <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">Nenhum comando na fila</p>
                  <p className="text-[9px] text-zinc-700 font-bold">Envie músicas usando o painel ao lado</p>
                </div>
              ) : (
                tracks.map(track => {
                  const isCompleted = track.status === 'completed';
                  const isDownloading = track.status === 'downloading';
                  const isFailed = track.status === 'failed';
                  return (
                    <div 
                      key={track.id} 
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-sm border transition-all",
                        isCompleted ? 'bg-green-500/5 border-green-500/10 opacity-60 hover:opacity-100' 
                          : isDownloading ? 'bg-blue-500/5 border-blue-500/15'
                          : isFailed ? 'bg-red-500/5 border-red-500/10' 
                          : 'bg-white/3 border-white/5 hover:border-white/10'
                      )}
                    >
                      <StatusIcon status={track.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate leading-none">{track.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {track.albumTitle && (
                            <span className="text-[8px] font-bold text-zinc-600 uppercase truncate max-w-[80px]">{track.albumTitle}</span>
                          )}
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest flex-shrink-0",
                            isCompleted ? 'text-green-500' : isDownloading ? 'text-blue-400' : isFailed ? 'text-red-500' : 'text-amber-500'
                          )}>
                            {statusLabel(track.status)}
                          </span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteCommand(track.id)} 
                        className="w-7 h-7 text-zinc-700 hover:text-red-400 hover:bg-red-950/30 flex-shrink-0 rounded-sm transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-20" />
    </div>
  );
}
