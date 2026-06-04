const CACHE = 'beatcue-v2';

// Installation — cache les ressources statiques
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(['/participant.html', '/manifest.json'])
        .catch(() => {}) // ignorer les erreurs de cache au premier install
    )
  );
  // PAS de skipWaiting — attendre que l'onglet soit fermé avant d'activer
});

// Activation — nettoyage des vieux caches seulement
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
    // PAS de clients.claim() — évite le rechargement forcé
  );
});

// Fetch — réseau d'abord, cache en fallback uniquement pour les ressources statiques
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Ne jamais intercepter : API, iTunes, ressources externes
  if (url.pathname.startsWith('/api/') || url.hostname !== location.hostname) return;
  // Seulement pour les requêtes GET
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request) || new Response('Hors ligne', {status: 503}))
  );
});

// Notifications via postMessage depuis la page
self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      tag: 'beatcue-position',
      renotify: true,
      vibrate: [200, 100, 200]
    });
  }
});
