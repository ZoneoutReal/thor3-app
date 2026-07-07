const CACHE_NAME = "thor3-v2";

// Self-locate: the SW is served at <base>/sw.js, so strip the filename to get
// the base path. Works at root ("") and under a GitHub Pages subpath ("/thor3-app").
const BASE = self.location.pathname.replace(/\/sw\.js$/, "");
const OFFLINE_URLS = [`${BASE}/`, `${BASE}/icon-192.png`, `${BASE}/icon-512.png`];
const ICON = `${BASE}/icon-192.png`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: ICON,
      badge: ICON,
      vibrate: [200, 100, 200],
      tag: data.tag || "thor3",
      data: { url: `${BASE}/` },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || `${BASE}/`));
});
