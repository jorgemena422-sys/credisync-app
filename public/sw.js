const BUILD_VERSION = '20260327200152695-dztqop';
const CACHE_NAME = `credisync-shell-${BUILD_VERSION}`;
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

async function cacheNavigationShell(response) {
  if (!response || !response.ok) {
    return response;
  }

  const cache = await caches.open(CACHE_NAME);
  await Promise.all([
    cache.put('/', response.clone()).catch(() => undefined),
    cache.put('/index.html', response.clone()).catch(() => undefined)
  ]);

  return response;
}

function buildPushNotificationActions(payload) {
  const actions = [];

  if (payload?.primaryAction?.action && payload?.primaryAction?.title) {
    actions.push({
      action: payload.primaryAction.action,
      title: payload.primaryAction.title
    });
  }

  if (payload?.secondaryAction?.action && payload?.secondaryAction?.title) {
    actions.push({
      action: payload.secondaryAction.action,
      title: payload.secondaryAction.title
    });
  }

  if (actions.length === 0) {
    actions.push(
      { action: 'open-default', title: 'Ver' },
      { action: 'dismiss', title: 'Cerrar' }
    );
  } else {
    actions.push({ action: 'dismiss', title: 'Cerrar' });
  }

  return actions.slice(0, 3);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
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

self.addEventListener('message', (event) => {
  const payload = event && event.data ? event.data : {};

  if (payload.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheNavigationShell(response))
        .catch(async () => {
          const cachedResponse = await caches.match(request, { ignoreSearch: true })
            || await caches.match('/')
            || await caches.match('/index.html');
          return cachedResponse;
        })
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'CrediSync';
  const body = payload.body || 'Tienes una actualizacion de cobranza';
  const url = payload.url || '/notifications';
  const tag = payload.tag || 'credisync-general';
  const actions = buildPushNotificationActions(payload);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: payload.icon || '/icons/icon-512.png',
      badge: payload.badge || '/icons/app-icon.svg',
      tag,
      renotify: payload.renotify !== false,
      requireInteraction: Boolean(payload.requireInteraction),
      vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [100, 50, 100, 50, 200],
      data: {
        url,
        actions: {
          [payload.primaryAction?.action || '']: payload.primaryAction?.url || url,
          [payload.secondaryAction?.action || '']: payload.secondaryAction?.url || '/notifications',
          open_default: url
        },
        type: payload.type || 'general',
        context: payload.context || {}
      },
      actions
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const data = event.notification?.data || {};
  const actionMap = data.actions || {};
  const targetUrl = actionMap[event.action] || actionMap.open_default || data.url || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => client.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'OPEN_URL', url: targetUrl });
        return;
      }
      return clients.openWindow(targetUrl);
    })
  );
});