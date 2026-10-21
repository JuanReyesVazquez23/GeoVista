/* GeoVista Service Worker.
 *
 * Estrategia:
 *  - Precache del shell de entrada, el modal y la textura 2D. El chunk 3D
 *    (three.js, ~2 MB) NO se precarga: se cachea solo cuando se usa.
 *  - Assets hasheados e imágenes locales: cache-first.
 *  - Fotos externas: stale-while-revalidate.
 *  - Navegación y API: network-first con timeout y fallback offline.
 *  - Sorteo y admin: siempre red (nunca caché).
 *
 * Vite inyecta VERSION y PRECACHE al construir (ver vite.config.ts). Este
 * archivo se mantiene como JS válido para que el lint no necesite excepciones.
 */
const VERSION = 'dev';
const PRECACHE = ['/'];

const SHELL_CACHE = `geovista-${VERSION}`;
const RUNTIME_CACHE = `${SHELL_CACHE}-runtime`;
const NAV_TIMEOUT_MS = 3500;
const API_TIMEOUT_MS = 4000;

// No activar automáticamente: la app avisa y el usuario decide cuándo recargar.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith('geovista-') &&
              key !== SHELL_CACHE &&
              key !== RUNTIME_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { cache: 'no-store', signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  // ignoreVary: el precache se hizo con un Origin distinto al de la navegación
  // offline; para assets estáticos same-origin la respuesta es la misma.
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;

  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true });
  const network = fetch(request)
    .then(async (response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return hit || (await network) || Response.error();
}

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetchWithTimeout(request, timeoutMs);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await caches.match('/index.html', { ignoreVary: true });
      if (shell) return shell;
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // El sorteo debe ser distinto en cada llamada y el admin depende de una clave:
  // ninguno pasa por caché.
  if (url.pathname === '/api/places/random' || url.pathname.startsWith('/api/admin/')) {
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(networkFirst(request, RUNTIME_CACHE, API_TIMEOUT_MS));
      return;
    }

    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, SHELL_CACHE, NAV_TIMEOUT_MS));
      return;
    }

    // Entry + chunks + CSS: están (o se añaden) en el shell cache.
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request, SHELL_CACHE));
      return;
    }

    if (
      request.destination === 'manifest' ||
      url.pathname === '/manifest.webmanifest' ||
      request.destination === 'image' ||
      /\.(png|svg|webp|jpg|jpeg|ico)$/.test(url.pathname)
    ) {
      event.respondWith(cacheFirst(request, SHELL_CACHE));
    }
    return;
  }

  // Fotos y texturas de terceros: SWR para que no bloqueen si la red falla.
  if (
    request.destination === 'image' &&
    ['images.unsplash.com', 'loremflickr.com', 'picsum.photos', 'unpkg.com'].includes(
      url.hostname,
    )
  ) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});
