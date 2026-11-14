const CACHE = 'hemmi-v1';
const ASSETS = ['./', 'index.html', 'style.css', 'game.js', 'manifest.webmanifest',
  ...['hemmi_idle','hemmi_run','hemmi_jump','hemmi_happy','hemmi_mischief','mango','star','dragonfruit','coconuts','crab','rock','crate','urchin','ball','shades','lei','surfboard','hat','bg_beach','bg_jungle','bg_town','bg_volcano','panel1','panel2','panel3','panel4','panel5'].map(n => 'img/' + n + '.webp'),
  'img/icon-192.png', 'img/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; }))); });
