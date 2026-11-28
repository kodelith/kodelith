const CACHE_NAME = "kodelith-shell-v1";
const STATIC_CACHE = "kodelith-assets-v1";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(new Request(new URL("./", self.registration.scope), { cache: "reload" }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("kodelith-") && ![CACHE_NAME, STATIC_CACHE].includes(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isNavigation = request.mode === "navigate";
  const isStaticAsset = ["script", "style", "image", "font"].includes(request.destination);

  if (isNavigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(new Request(new URL("./", self.registration.scope)), response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        return (await cache.match(request)) || (await cache.match(new URL("./", self.registration.scope))) || new Response("Kodelith is not available offline yet. Connect once to load and cache the editor.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  if (!isStaticAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then(response => {
      if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone()).catch(() => {});
      return response;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return (await network) || new Response("", { status: 504, statusText: "Offline asset unavailable" });
  })());
});
