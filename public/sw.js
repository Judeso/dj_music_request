const CACHE = 'beatcue-v1';
const OFFLINE_URLS = ['/participant.html'];

// Installation — mise en cache des ressources essentielles
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Activation — nettoyage des anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — réseau en priorité, cache en fallback
self.addEventListener('fetch', e => {
  // Ne pas intercepter les appels API
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Notifications push (si implémenté plus tard)
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || '🎵 DJ Music Request', {
      body: data.body || '',
      icon: '/manifest.json',
      tag: 'beatcue',
      renotify: true,
      vibrate: [200, 100, 200]
    })
  );
});

// Message depuis la page — afficher une notif
self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      tag: 'beatcue-position',
      renotify: true,
      vibrate: [200, 100, 200],
      icon: '/manifest.json'
    });
  }
});
