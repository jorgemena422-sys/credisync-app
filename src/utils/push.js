import { apiRequest } from './api';

export function isPushSupportedInBrowser() {
    return typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

export function currentBrowserTimezone() {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return String(tz || '').trim() || 'America/Santo_Domingo';
    } catch {
        return 'America/Santo_Domingo';
    }
}

export function inferDeviceLabel() {
    const ua = String(navigator.userAgent || '').toLowerCase();
    if (ua.includes('iphone')) return 'iPhone';
    if (ua.includes('ipad')) return 'iPad';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('mac os')) return 'Mac';
    if (ua.includes('windows')) return 'Windows';
    return 'Dispositivo web';
}

function decodeBase64UrlToUint8Array(base64Url) {
    const input = String(base64Url || '').trim();
    if (!input) return new Uint8Array();

    const padded = `${input}${'='.repeat((4 - (input.length % 4)) % 4)}`
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const raw = atob(padded);
    const output = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index += 1) {
        output[index] = raw.charCodeAt(index);
    }

    return output;
}

export async function ensurePushServiceWorker() {
    if (!isPushSupportedInBrowser()) {
        throw new Error('Este navegador no soporta notificaciones push web.');
    }

    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return registration;
}

export async function fetchPushStatus() {
    return apiRequest('/push/status');
}

export async function subscribeToPush(vapidPublicKey, options = {}) {
    if (!vapidPublicKey) {
        throw new Error('La clave publica de push no esta disponible.');
    }

    const registration = await ensurePushServiceWorker();
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64UrlToUint8Array(vapidPublicKey)
    });

    const timezone = options.timezone || currentBrowserTimezone();
    const deviceLabel = options.deviceLabel || inferDeviceLabel();

    await apiRequest('/push/subscribe', {
        method: 'POST',
        body: {
            timezone,
            deviceLabel,
            subscription: subscription.toJSON()
        }
    });

    return subscription;
}

export async function unsubscribeFromPush() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
        await apiRequest('/push/unsubscribe', {
            method: 'POST',
            body: {
                endpoint: subscription.endpoint
            }
        });
        await subscription.unsubscribe();
    } else {
        await apiRequest('/push/unsubscribe', { method: 'POST', body: {} });
    }

    return true;
}

export async function sendPushTest(timezone) {
    return apiRequest('/push/test', {
        method: 'POST',
        body: {
            timezone: timezone || currentBrowserTimezone()
        }
    });
}