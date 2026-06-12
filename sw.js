// 김공장 서비스워커 — 앱 셸 캐시(오프라인) + 백그라운드 갱신
const CACHE = 'soltri-hub-v21';
const ASSETS = ['./', 'index.html', 'o0852.html', 'o0400.html', 'o8000.html', 'simulator.html', 'firststep.html', 'cheatsheet.html', 'quiz.html', 'taehyung.html',
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
