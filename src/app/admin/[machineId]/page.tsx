'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Trash2, Home, FolderUp, Music } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { getApp } from 'firebase/app';

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  createdAt: any;
  status?: string;
}

export default function MachineAdminPage({ params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = use(params);
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload States
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Link States
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

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

    // Group files by their parent folder
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
          // Keep the first image or one named 'cover/folder/capa'
          const name = file.name.toLowerCase();
          if (!groups[folderName].image || name.includes('cover') || name.includes('folder') || name.includes('capa')) {
            groups[folderName].image = file;
          }
        }
      }
    }

    let completed = 0;
    const totalToUpload = audioFiles.length;

    // 1. Process Grouped Folders
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
            uploadTask.on('state_changed', 
              null, // let the overall progress handle it
              (error) => reject(error),
              () => resolve()
            );
          });
          
          const downloadUrl = await getDownloadURL(storageRef);
          
          await addDoc(collection(firestore, `machines/${machineId}/music_commands`), {
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Pasta Upload',
            url: data.url,
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

    // 2. Process Loose Files (not in groups we just made)
    const groupedFileNames = new Set(Object.values(groups).flatMap(g => g.audio.map(f => f.name)));
    const looseFiles = audioFiles.filter(f => !groupedFileNames.has(f.name));

    for (const file of looseFiles) {
      setCurrentFileName(file.name);
      try {
        const storage = getStorage();
        const storageRef = ref(storage, `machines/${machineId}/uploads/loose_files/${file.name}`);
        
        await new Promise<void>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(storageRef, file);
          uploadTask.on('state_changed', 
            null, 
            (error) => reject(error),
            () => resolve()
          );
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
    
    // reset inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const convertSharedLink = (url: string) => {
    // Google Drive
    const gDriveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gDriveMatch && gDriveMatch[1]) {
      return `https://drive.google.com/uc?export=download&confirm=t&id=${gDriveMatch[1]}`;
    }
    // Dropbox
    if (url.includes('dropbox.com')) {
      try {
        const dropboxUrl = new URL(url);
        dropboxUrl.searchParams.set('dl', '1');
        return dropboxUrl.toString();
      } catch (e) {
        return url;
      }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h2 className="text-xl md:text-2xl font-semibold break-all">Máquina: {machineId.slice(0, 8)}...</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Enviar Músicas Locais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="w-full bg-zinc-950 hover:bg-zinc-900 border-zinc-800"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Music className="w-4 h-4 mr-2" />
                Arquivos (.mp3)
              </Button>
              
              {/* @ts-ignore - webkitdirectory is non-standard but heavily supported */}
              <Button 
                variant="outline" 
                className="w-full bg-zinc-950 hover:bg-zinc-900 border-zinc-800"
                onClick={() => folderInputRef.current?.click()}
                disabled={uploading}
              >
                <FolderUp className="w-4 h-4 mr-2" />
                Pasta Inteira
              </Button>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink-0 mx-4 text-xs text-zinc-500 uppercase">Ou colar link livre (Google Drive ou Dropbox)</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="Título da Música (Ex: Exaltasamba - Tá Vendo Aquela Lua)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                disabled={uploading}
              />
              <Input
                placeholder="Cole o link do Google Drive ou Dropbox aqui..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                disabled={uploading}
              />
              <Button onClick={handleAddLink} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" disabled={uploading}>
                Enviar Link direto para a Máquina
              </Button>
            </div>

            <input 
              type="file" 
              multiple 
              accept="audio/*" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={(e) => processFiles(e.target.files)} 
            />
            <input 
              type="file" 
              // @ts-ignore
              webkitdirectory="true" 
              directory="true" 
              ref={folderInputRef} 
              className="hidden" 
              onChange={(e) => processFiles(e.target.files)} 
            />

            {uploading && (
              <div className="space-y-2 mt-4 p-4 rounded-lg bg-zinc-950 border border-zinc-800">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Enviando...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-zinc-500 truncate text-center">
                  Processando: {currentFileName}
                </p>
                <p className="text-xs text-amber-500 text-center font-semibold mt-1">
                  Não feche esta página enquanto carrega
                </p>
              </div>
            )}
            {!uploading && (
              <p className="text-xs text-zinc-500 text-center">
                Os arquivos serão salvos no Firebase Storage e a máquina os baixará automaticamente para a memória interna.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 flex flex-col h-[500px]">
          <CardHeader>
            <CardTitle>Fila de Downloads na Máquina</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pr-2">
            {loading ? (
              <p className="text-sm text-zinc-400">Carregando comandos...</p>
            ) : tracks.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhum comando na fila recente.</p>
            ) : (
              <div className="space-y-3">
                {tracks.map(track => {
                   const isCompleted = track.status === 'completed';
                   const isDownloading = track.status === 'downloading';
                   const isFailed = track.status === 'failed';
                   return (
                  <div key={track.id} className={`flex items-center justify-between p-3 rounded-lg border ${isCompleted ? 'bg-green-500/5 border-green-500/20' : isFailed ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-950 border-zinc-800'}`}>
                    <div className="overflow-hidden pr-4">
                      <p className="font-medium text-sm truncate">{track.title}</p>
                      <p className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-500' : isDownloading ? 'bg-blue-500 animate-pulse' : isFailed ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                        {isCompleted ? 'Baixado' : isDownloading ? 'Baixando...' : isFailed ? 'Falhou (Link Quebrado/CORS)' : 'Pendente...'}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCommand(track.id)} className="text-red-400 hover:text-red-300 hover:bg-red-950/30 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )})}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
