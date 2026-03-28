
export type Track = {
  id: string;
  title: string;
  duration: string;
  file?: File;
  relativePath?: string; // Caminho dentro do handle USB
  type: 'audio' | 'video';
};

export type QueuedTrack = Track & {
  albumTitle: string;
  artist: string;
  isRandomAutoPlay?: boolean;
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  coverBlob?: Blob;
  genre: string;
  tracks: Track[];
  isDirectAccess?: boolean; // Indica se o álbum é lido diretamente do USB
};

export type VisualizerVideo = {
  id: string;
  name: string;
  file?: File;
  relativePath?: string;
};

export const ALBUMS: Album[] = [];

export const GENRES = [
  "Pagode",
  "Funk",
  "Sertanejo",
  "Samba",
  "Rock",
  "Pop",
  "Forró",
  "Axé",
  "Eletrônica",
  "Outros"
];
