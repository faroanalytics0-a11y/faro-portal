// FARO — Portal de Campo: guarda la página en el teléfono para que abra sin señal.
// Va en la misma carpeta que index.html. Los registros sin señal ya se guardan
// aparte (localStorage); aquí solo se guarda la página y sus letras.
const CACHE = 'faro-campo-v3';
const PAGINA = './';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(PAGINA, {cache: 'reload'}))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pide a la red, pero si en 4 segundos no contesta (o no hay señal) usa lo guardado.
function redOGuardado(req, clave) {
  return caches.open(CACHE).then(c => c.match(clave).then(guardado => {
    const red = fetch(req).then(r => {
      if (r && r.ok) c.put(clave, r.clone());
      return r;
    });
    if (!guardado) return red;
    const espera = new Promise(res => setTimeout(() => res(guardado), 4000));
    return Promise.race([red.catch(() => guardado), espera]);
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La página del portal (con o sin index.html, con o sin ?...)
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith(redOGuardado(req, PAGINA));
    return;
  }
  // Letras de Google: se guardan la primera vez y después se usan de lo guardado.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(g => g || fetch(req).then(r => { c.put(req, r.clone()); return r; }))));
  }
  // Todo lo demás (el servidor de Google Sheets) pasa directo, sin tocarlo.
});
