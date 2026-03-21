import { Album, VisualizerVideo } from './jukebox-data';

const DB_NAME = 'JukeboxMontanhaDB';
const DB_VERSION = 3; // Versão 3: Adicionado store para handle USB
const STORE_NAME = 'albums';
const VISUALIZERS_STORE = 'visualizers';
const USB_HANDLE_STORE = 'usb_handle';

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(VISUALIZERS_STORE)) {
        db.createObjectStore(VISUALIZERS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(USB_HANDLE_STORE)) {
        db.createObjectStore(USB_HANDLE_STORE);
      }
    };
  });
}

export async function saveAlbum(album: Album): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(album);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function saveAlbumsBulk(albums: Album[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    albums.forEach(album => {
      store.put(album);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllAlbums(): Promise<Album[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function deleteAlbumFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function saveVisualizers(videos: VisualizerVideo[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VISUALIZERS_STORE, 'readwrite');
    const store = transaction.objectStore(VISUALIZERS_STORE);
    videos.forEach(v => store.put(v));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllVisualizers(): Promise<VisualizerVideo[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VISUALIZERS_STORE, 'readonly');
    const store = transaction.objectStore(VISUALIZERS_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function clearVisualizers(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VISUALIZERS_STORE, 'readwrite');
    const store = transaction.objectStore(VISUALIZERS_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveUSBHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(USB_HANDLE_STORE, 'readwrite');
    const store = transaction.objectStore(USB_HANDLE_STORE);
    const request = store.put(handle, 'main_usb');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getUSBHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(USB_HANDLE_STORE, 'readonly');
      const store = transaction.objectStore(USB_HANDLE_STORE);
      const request = store.get('main_usb');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null); // Ignora erros se não houver handle
    } catch (e) {
      resolve(null);
    }
  });
}

export async function clearUSBHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(USB_HANDLE_STORE, 'readwrite');
    const store = transaction.objectStore(USB_HANDLE_STORE);
    const request = store.delete('main_usb');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}