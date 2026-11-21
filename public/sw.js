const CACHE_NAME = "mangakadesk-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never intercept cross-origin APIs (Firebase, Google Auth, GitHub) or Firebase auth handlers.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/__/")) return;

  // Network-first so app updates always arrive immediately while providing basic offline fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
        }
        return Response.error();
      }),
  );
});
