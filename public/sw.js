const CACHE_NAME = 'jukebox-offline-v2';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.ico'
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
  
  // 1. Ignora chamadas de API (Mercado Pago, Firebase Auth/Firestore)
  // 2. O Cache API só suporta o método GET. Ignoramos qualquer outro método (POST da API, etc)
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') || 
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase')
  ) {
    return; // Deixa o navegador/Electron tratar normalmente via rede
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Se houver cache, retornamos ele enquanto atualizamos em background (Stale-While-Revalidate)
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
        }
        return networkResponse;
      }).catch((err) => {
        // Erro de rede (OFFLINE)
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        // Se já tivermos o cache, retornamos ele.
        if (cachedResponse) return cachedResponse;
        
        // No pior caso (sem rede e sem cache), lançamos o erro para o navegador 
        // mas garantimos que retornamos ALGO se o respondWith nos obrigar.
        throw err;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

