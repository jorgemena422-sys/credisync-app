const configuredTarget = String(import.meta.env.VITE_RUNTIME_TARGET || '').trim().toLowerCase();

function inferTargetFromHost() {
    if (typeof window === 'undefined') {
        return 'prod';
    }

    const host = String(window.location.hostname || '').toLowerCase();
    if (host.includes('staging')) {
        return 'staging';
    }

    return 'prod';
}

export const runtimeTarget = configuredTarget || inferTargetFromHost();
export const isStagingRuntimeTarget = runtimeTarget === 'staging';
