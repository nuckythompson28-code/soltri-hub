// 김공장 서비스워커 — 앱 셸 캐시(오프라인) + 백그라운드 갱신
const CACHE = 'soltri-hub-v65-unit7-measured-20261002';
const ASSETS = ['models/unit7/user-geometry.json','docs/evidence/unit7-tools-20261002.png','machine-models.js','machine-model-ui.js','machine-models.css','models/kit60g/context.glb','models/kit60g/specs.json','docs/evidence/kit60g-specs-20261002.png','simulator-unit7-3d.js','simulator-unit7-3d.css','models/unit7/carriage.glb','models/unit7/setup.json','vendor/three/build/three.module.js','vendor/three/build/three.core.js','vendor/three/examples/jsm/controls/OrbitControls.js','vendor/three/examples/jsm/loaders/GLTFLoader.js','vendor/three/examples/jsm/utils/BufferGeometryUtils.js','o2028.html','programs/o2028/drawing-simulation.txt','programs/o2028/drawing-draft.txt','programs/o2028/original-set.txt','programs/o2028/evidence/4.png','machine-programs.js', 'machine-programs-ui.js', 'machine-programs.css', './', 'index.html', 'status.html', 'cnc-errors.html', 'dorm.html', 'machines.html', 'mtest.html', 'cfbackup.html', 'o0852.html', 'o0400.html', 'o8000.html', 'o8000-guide.html', 'o0400-guide.html', 'o0852-guide.html', 'simulator.html', 'firststep.html', 'cheatsheet.html', 'quiz.html', 'taehyung.html',
  'simulator.css', 'simulator-unit5-gang.js', 'simulator-samples.js', 'simulator-engine.js', 'simulator.js',
  'machine-setups.js', 'machine-setup-ui.js', 'machine-setup.css', 'machine-controllers.js', 'docs/evidence/unit5-geometry-20260911.png',
  'factory-layout.js', 'factory-layout.css', 'docs/evidence/factory-layout-20260911.png',
  'ui.css', 'ui.js',
  'o2026.html', 'o2026.js', 'programs/o2026-o2027-jeil-unit5.nc',
  'o0500.html', 'o0500.js', 'programs/o0500-unit5.nc', 'programs/o0500-unit5-package.zip', 'programs/o0500/README.txt', 'programs/o0500/O0500.nc', 'programs/o0500/O0500.txt', 'programs/o0500/O9030.nc', 'programs/o0500/O9030.txt', 'programs/o0500/O9031.nc', 'programs/o0500/O9031.txt', 'programs/o0500/O9032.nc', 'programs/o0500/O9032.txt', 'programs/o0500/O9033.nc', 'programs/o0500/O9033.txt', 'programs/o0500/O9034.nc', 'programs/o0500/O9034.txt', 'o0600.html', 'o0600.js', 'programs/o0600-unit5.nc', 'programs/o0600-unit5-package.zip', 'programs/o0600/README.txt', 'programs/o0600/O0600.nc', 'programs/o0600/O0600.txt', 'programs/o0600/O9050.nc', 'programs/o0600/O9050.txt',
  'o0600-patch.html', 'programs/patches/unit5-o9050-manual-patch-20260910.txt',
  'o0300.html', 'o0300.css', 'programs/o0300/photo-transcript.txt', 'programs/o0300/provenance.json',
  'programs/o0300/photos/01-main.jpg', 'programs/o0300/photos/02-setup.jpg', 'programs/o0300/photos/03-boring-chamfer.jpg', 'programs/o0300/photos/04-parting-remainder.jpg', 'programs/o0300/photos/05-remainder-exit.jpg',
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
  // The simulator's HTML and scripts must show the current revision on the first
  // online load. Keep a cached copy only as an offline fallback.
  const simulatorFiles = ['machine-setups.js','machine-programs.js','machine-programs-ui.js','machine-models.js','machine-model-ui.js','machine-models.css','simulator.html', 'simulator.js', 'simulator-engine.js',
    'simulator-unit5-gang.js', 'simulator-samples.js', 'simulator.css', 'simulator-unit7-3d.js', 'simulator-unit7-3d.css'];
  if (simulatorFiles.includes(url.pathname.split('/').pop()) || url.pathname.includes('/models/unit7/') || url.pathname.includes('/models/kit60g/')) {
    e.respondWith((async () => {
      try {
        const response = await fetch(e.request, {cache: 'no-cache'});
        if (!response.ok) throw new Error('Simulator resource unavailable');
        const cache = await caches.open(CACHE);
        await cache.put(e.request, response.clone());
        return response;
      } catch (error) {
        return (await caches.match(e.request)) ||
          (await caches.match(e.request, {ignoreSearch: true})) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(caches.match(e.request).then(cached => {
    const net = fetch(e.request).then(resp => {
      if (resp && resp.status === 200) { const cp = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return resp;
    }).catch(() => cached);
    return cached || net;
  }));
});
