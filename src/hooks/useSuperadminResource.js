import { useCallback, useEffect, useState } from 'react';

const superadminResourceCache = new Map();

export function invalidateSuperadminResource(cacheKey) {
    superadminResourceCache.delete(cacheKey);
}

export function setSuperadminResource(cacheKey, data) {
    superadminResourceCache.set(cacheKey, {
        data,
        updatedAt: Date.now()
    });
}

export function useSuperadminResource(cacheKey, fetcher, fallbackData) {
    const cachedEntry = superadminResourceCache.get(cacheKey);
    const hasCachedData = Boolean(cachedEntry);

    const [data, setData] = useState(() => (hasCachedData ? cachedEntry.data : fallbackData));
    const [loading, setLoading] = useState(() => !hasCachedData);
    const [refreshing, setRefreshing] = useState(false);

    const refresh = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            if (superadminResourceCache.has(cacheKey)) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
        }

        try {
            const nextData = await fetcher();
            setSuperadminResource(cacheKey, nextData);
            setData(nextData);
            return nextData;
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [cacheKey, fetcher]);

    useEffect(() => {
        refresh({ silent: superadminResourceCache.has(cacheKey) }).catch(() => undefined);
    }, [cacheKey, refresh]);

    return {
        data,
        setData,
        loading,
        refreshing,
        refresh,
        hasCachedData: superadminResourceCache.has(cacheKey)
    };
}
