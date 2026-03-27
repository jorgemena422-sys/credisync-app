import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const templatePath = path.join(rootDir, 'public', 'sw-template.js');
const outputPath = path.join(rootDir, 'public', 'sw.js');
const buildVersion = `${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${Math.random().toString(36).slice(2, 8)}`;

const template = fs.readFileSync(templatePath, 'utf8');
const normalizedTemplate = template
  .replace(
    "const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];",
    `const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

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
}`
  )
  .replace(
    /\.then\(\(response\) => \{[\s\S]*?return response;\s*\}\)\s*\.catch\(\(\) => caches\.match\('\/index\.html'\)\)/,
    `.then((response) => cacheNavigationShell(response))
        .catch(async () => {
          const cachedResponse = await caches.match(request, { ignoreSearch: true })
            || await caches.match('/')
            || await caches.match('/index.html');
          return cachedResponse;
        })`
  )
  .replace(
    /self\.addEventListener\('push',[\s\S]*?self\.addEventListener\('notificationclick',[\s\S]*?\n\}\);\s*$/,
    `self.addEventListener('push', (event) => {
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
});`
  )
  .replace(
    /self\.addEventListener\('notificationclick',[\s\S]*?\n\}\);\s*$/,
    `self.addEventListener('notificationclick', (event) => {
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
});`
  );

if (!normalizedTemplate.includes('__SW_VERSION__')) {
  throw new Error('Service worker template is missing the __SW_VERSION__ placeholder.');
}

fs.writeFileSync(outputPath, normalizedTemplate.replace(/__SW_VERSION__/g, buildVersion), 'utf8');

console.log(`[generate-sw] Generated public/sw.js (${buildVersion})`);
