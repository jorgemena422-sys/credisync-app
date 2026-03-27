import { isStagingRuntimeTarget } from './runtimeTarget';

function canUseStorage() {
    return isStagingRuntimeTarget && typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function readStagingDraft(key, fallback) {
    if (!canUseStorage()) {
        return fallback;
    }

    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
            return fallback;
        }
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function saveStagingDraft(key, value) {
    if (!canUseStorage()) {
        return;
    }

    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
}

export function clearStagingDraft(key) {
    if (!canUseStorage()) {
        return;
    }

    try {
        window.localStorage.removeItem(key);
    } catch {}
}
