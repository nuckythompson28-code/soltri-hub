// 김공장 서비스워커 — 앱 셸 캐시(오프라인) + 백그라운드 갱신
const CACHE = 'soltri-hub-v36-o0500-default3-20260910';
const ASSETS = ['./', 'index.html', 'status.html', 'cnc-errors.html', 'dorm.html', 'machines.html', 'mtest.html', 'cfbackup.html', 'o0852.html', 'o0400.html', 'o8000.html', 'o8000-guide.html', 'o0400-guide.html', 'o0852-guide.html', 'simulator.html', 'firststep.html', 'cheatsheet.html', 'quiz.html', 'taehyung.html',
  'o2026.html', 'o2026.js', 'programs/o2026-o2027-jeil-unit5.nc',
  'o0500.html', 'o0500.js', 'programs/o0500-unit5.nc', 'programs/o0500-unit5-package.zip', 'programs/o0500/README.txt',
  'programs/o0500/O0500.nc', 'programs/o0500/O9030.nc', 'programs/o0500/O9031.nc', 'programs/o0500/O9032.nc', 'programs/o0500/O9033.nc', 'programs/o0500/O9034.nc',
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
