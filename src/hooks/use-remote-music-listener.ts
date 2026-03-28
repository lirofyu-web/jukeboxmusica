'use client';

import { useEffect } from 'react';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { saveAlbum } from '@/lib/db';

export function useRemoteMusicListener(machineId: string | null) {
  const firestore = useFirestore();

  useEffect(() => {
    if (!machineId || !firestore) return;

    const q = query(
      collection(firestore, `machines/${machineId}/music_commands`),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const commandDoc = change.doc;
          const data = commandDoc.data();
          
          if (data.command === 'DOWNLOAD_TRACK' && data.url) {
            try {
              // 1. Mark as downloading
              await updateDoc(commandDoc.ref, { status: 'downloading' });

              // 2. Fetch the file via the proxy to bypass CORS on the browser
              const { getProxyUrl } = await import('@/lib/platform');
              const proxyUrl = getProxyUrl(data.url);
              const response = await fetch(proxyUrl);
              const contentType = response.headers.get('content-type') || '';
              if (!response.ok) throw new Error('Failed to fetch media file via proxy');
              const blob = await response.blob();
              
              if (blob.type.includes('text/html') || contentType.includes('text/html')) {
                throw new Error('Link bloqueado pelo Google (Privado ou Aviso de Vírus).');
              }
              
              // Detect if it's a video based on URL or title
              const isVideo = data.url.toLowerCase().endsWith('.mp4') || data.title?.toLowerCase().endsWith('.mp4');
              const fileType = isVideo ? 'video/mp4' : 'audio/mpeg';
              const fileExtension = isVideo ? 'mp4' : 'mp3';

              // We need a File object for the Track
              const file = new File([blob], `${data.title || 'track'}.${fileExtension}`, { type: fileType });

              // 3. Create or update the target album
              const isDedicatedAlbum = !!data.albumTitle;
              let albumId: string;
              let albumTitle: string;
              let albumCover: string;
              let albumGenre = "Novidades";

              if (isDedicatedAlbum) {
                albumTitle = data.albumTitle;
                // Generate a stable ID based on the title
                albumId = `remote_album_${albumTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                albumCover = data.albumCover || '/images/default-album.png';
              } else {
                const date = new Date();
                const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                const currentMonthName = monthNames[date.getMonth()];
                const currentYear = date.getFullYear();
                
                const { generateCoverDataUrl } = await import('@/lib/generate-cover');
                
                albumId = `remote_lancamentos_${date.getMonth()}_${currentYear}`;
                albumTitle = `Lançamentos ${currentMonthName} ${currentYear}`;
                albumCover = generateCoverDataUrl(currentMonthName, currentYear.toString());
              }

              const { getAllAlbums } = await import('@/lib/db');
              const allAlbums = await getAllAlbums();
              let targetAlbum = allAlbums.find(a => a.id === albumId);

              const newTrack = {
                id: `track_${commandDoc.id}`,
                title: data.title || 'Remote Track',
                duration: '0:00',
                file: file,
                type: (isVideo ? 'video' : 'audio') as 'audio' | 'video'
              };

              if (!targetAlbum) {
                targetAlbum = {
                  id: albumId,
                  title: albumTitle,
                  artist: 'Nuvem Jukebox',
                  coverUrl: albumCover,
                  genre: albumGenre,
                  tracks: [newTrack],
                  isDirectAccess: false
                };
              } else {
                if (!targetAlbum.tracks.some(t => t.id === newTrack.id)) {
                  targetAlbum.tracks.push(newTrack);
                }
              }

              // 4. Save to IndexedDB
              await saveAlbum(targetAlbum);

              // 5. Mark as completed
              await updateDoc(commandDoc.ref, { status: 'completed' });
              
              // Optional: reload the jukebox data
              // The user needs to refresh or we need a global event to trigger loadData in useJukebox
              window.dispatchEvent(new Event('jukebox-reload-data'));

            } catch (err: any) {
              console.error('Download failed:', err);
              await updateDoc(commandDoc.ref, { status: 'failed', error: err.message });
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, [machineId, firestore]);
}
