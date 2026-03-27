const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;
const UPDATE_RELOAD_FLAG = 'credisync-update-pending';

export function applyAppUpdate(registration) {
    if (!registration?.waiting) {
        return false;
    }

    sessionStorage.setItem(UPDATE_RELOAD_FLAG, '1');
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    return true;
}

export function registerAppServiceWorker({ onUpdateReady, onOpenUrl } = {}) {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return () => { };
    }

    let isMounted = true;
    let isReloading = false;
    let registrationRef = null;
    let updateIntervalId = null;

    const isStandaloneApp = () => {
        if (typeof window === 'undefined') {
            return false;
        }

        return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
    };

    const maybeApplyWaitingUpdate = () => {
        if (!registrationRef?.waiting || isReloading) {
            return false;
        }

        if (document.visibilityState === 'hidden' || isStandaloneApp()) {
            return applyAppUpdate(registrationRef);
        }

        notifyUpdateReady();
        return false;
    };

    const notifyUpdateReady = () => {
        if (!isMounted || !registrationRef?.waiting) {
            return;
        }

        onUpdateReady?.(registrationRef);
    };

    const watchInstallingWorker = (worker) => {
        if (!worker) {
            return;
        }

        worker.addEventListener('statechange', () => {
            if (!isMounted || worker.state !== 'installed') {
                return;
            }

            if (navigator.serviceWorker.controller) {
                maybeApplyWaitingUpdate();
            }
        });
    };

    const handleControllerChange = () => {
        if (isReloading || sessionStorage.getItem(UPDATE_RELOAD_FLAG) !== '1') {
            return;
        }

        isReloading = true;
        sessionStorage.removeItem(UPDATE_RELOAD_FLAG);
        window.location.reload();
    };

    const handleMessage = (event) => {
        const payload = event && event.data ? event.data : {};
        if (payload.type === 'OPEN_URL' && payload.url) {
            onOpenUrl?.(String(payload.url));
        }
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            maybeApplyWaitingUpdate();
            return;
        }

        if (document.visibilityState === 'visible') {
            registrationRef?.update?.().catch(() => undefined);
            maybeApplyWaitingUpdate();
        }
    };

    const handleForegroundRefresh = () => {
        registrationRef?.update?.().catch(() => undefined);
        maybeApplyWaitingUpdate();
    };

    const startRegistration = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            });

            if (!isMounted) {
                return;
            }

            registrationRef = registration;

            if (registration.installing) {
                watchInstallingWorker(registration.installing);
            }

            registration.addEventListener('updatefound', () => {
                watchInstallingWorker(registration.installing);
            });

            maybeApplyWaitingUpdate();

            updateIntervalId = window.setInterval(() => {
                registration.update().catch(() => undefined);
            }, UPDATE_CHECK_INTERVAL_MS);
        } catch {
            // Keep app boot resilient if service worker fails.
        }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.addEventListener('message', handleMessage);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleForegroundRefresh);
    window.addEventListener('online', handleForegroundRefresh);
    window.addEventListener('pageshow', handleForegroundRefresh);

    if (document.readyState === 'complete') {
        startRegistration();
    } else {
        window.addEventListener('load', startRegistration, { once: true });
    }

    return () => {
        isMounted = false;
        if (updateIntervalId) {
            window.clearInterval(updateIntervalId);
        }
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        navigator.serviceWorker.removeEventListener('message', handleMessage);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleForegroundRefresh);
        window.removeEventListener('online', handleForegroundRefresh);
        window.removeEventListener('pageshow', handleForegroundRefresh);
        window.removeEventListener('load', startRegistration);
    };
}
