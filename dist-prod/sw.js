const CACHE_NAME = "credisync-shell-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", clone)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "CrediSync";
  const body = payload.body || "Tienes una actualizacion de cobranza";
  const url = payload.url || "/notifications";
  const tag = payload.tag || "credisync-general";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-512.png",
      badge: "/icons/app-icon.svg",
      tag,
      renotify: true,
      vibrate: [100, 50, 100, 50, 200],
      data: { url },
      actions: [
        { action: "open", title: "Ver" },
        { action: "dismiss", title: "Cerrar" }
      ]
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification?.data?.url || "/notifications";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => client.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: "OPEN_URL", url: targetUrl });
        return;
      }
      return clients.openWindow(targetUrl);
    })
  );
});
