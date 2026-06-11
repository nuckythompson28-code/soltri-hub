// 源怨듭옣 ?쒕퉬?ㅼ썙而???????罹먯떆(?ㅽ봽?쇱씤) + 諛깃렇?쇱슫??媛깆떊
const CACHE = 'soltri-hub-v16';
const ASSETS = ['./', 'index.html', 'o0852.html', 'o0400.html', 'simulator.html', 'firststep.html', 'cheatsheet.html', 'quiz.html', 'taehyung.html',
  'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'scanner/', 'scanner/index.html', 'scanner/core.js', 'scanner/service.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(cached => {
    const net = fetch(e.request).then(resp => {
      if (resp && resp.status === 200) { const cp = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return resp;
    }).catch(() => cached);
    return cached || net;
  }));
});
