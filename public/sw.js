const CACHE_NAME = 'jukebox-offline-v2';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/images/default-album.png',
  '/images/jukebox-logo.png'
];

// 1. Instalação: Guarda o "Coração" do App (Shell)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Cacheando App Shell...');
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// 2. Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 3. Estratégia de Busca (Fetch)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignora chamadas de API (Mercado Pago, Firebase Auth/Firestore)
  // Deixamos a rede cuidar disso ou o SDK do Firebase que já tem offline nativo
  if (url.pathname.startsWith('/api/') || url.hostname.includes('googleapis.com')) {
    return;
  }

  // Estratégia: Cache-First para arquivos estáticos (JS, CSS, Imagens)
  // Estratégia: Stale-While-Revalidate para o restante (Páginas)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Se a resposta for válida, guarda no cache para a próxima vez
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheCopy);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Erro de rede (OFFLINE): Se for uma página, tenta retornar o '/' do cache (App Shell)
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return cachedResponse;
      });

      // Retorna o cache IMEDIATAMENTE se existir (Velocidade máxima),
      // enquanto o fetchPromise atualiza o cache "por baixo do pano" para a próxima vez.
      return cachedResponse || fetchPromise;
    })
  );
});
