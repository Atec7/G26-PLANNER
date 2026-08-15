/* G26 Planner · Service Worker
   Network-first para a origem e para os SDKs do Firebase;
   quando offline, usa o cache salvo na última visita. */
const CACHE = 'g26-planner-v1';

self.addEventListener('install', ()=>{
  self.skipWaiting();
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if(req.method!=='GET') return;
  const url = new URL(req.url);
  const isFirebase = url.href.startsWith('https://www.gstatic.com/firebasejs/');
  const isOrigin = url.origin === self.location.origin;
  if(!isOrigin && !isFirebase) return;
  e.respondWith(
    fetch(req)
      .then(res=>{
        const clone = res.clone();
        caches.open(CACHE).then(c=>c.put(req, clone)).catch(()=>{});
        return res;
      })
      .catch(()=> caches.match(req).then(cached=>cached || new Response('', {status:503, statusText:'Offline'})))
  );
});
