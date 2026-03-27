import { lazy } from 'react';

export function lazyWithPreload(factory) {
    const Component = lazy(factory);
    Component.preload = factory;
    return Component;
}

export function preloadComponents(components) {
    components.forEach((Component) => {
        if (Component && typeof Component.preload === 'function') {
            Component.preload().catch(() => undefined);
        }
    });
}
