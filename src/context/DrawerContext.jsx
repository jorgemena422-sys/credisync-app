import React, { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isStagingRuntimeTarget } from '../utils/runtimeTarget';
import { lazyWithPreload, preloadComponents } from '../utils/lazyWithPreload';

const NewCustomerDrawer = lazyWithPreload(() => import('../components/NewCustomerDrawer'));
const NewLoanDrawer = lazyWithPreload(() => import('../components/NewLoanDrawer'));
const NewPaymentDrawer = lazyWithPreload(() => import('../components/NewPaymentDrawer'));

const DRAWER_COMPONENTS = [NewCustomerDrawer, NewLoanDrawer, NewPaymentDrawer];

const DrawerContext = createContext(null);

export const DrawerProvider = ({ children }) => {
    const [activeDrawer, setActiveDrawer] = useState(null);

    const openDrawer = useCallback((drawerName) => setActiveDrawer(drawerName), []);
    const closeDrawer = useCallback(() => setActiveDrawer(null), []);
    const contextValue = useMemo(() => ({ activeDrawer, openDrawer, closeDrawer }), [activeDrawer, openDrawer, closeDrawer]);

    const stagingDrawer = activeDrawer === 'customer'
        ? <NewCustomerDrawer isOpen onClose={closeDrawer} />
        : activeDrawer === 'loan'
            ? <NewLoanDrawer isOpen onClose={closeDrawer} />
            : activeDrawer === 'payment'
                ? <NewPaymentDrawer isOpen onClose={closeDrawer} />
                : null;

    useEffect(() => {
        let idleId = null;
        let timeoutId = null;

        const warmDrawers = () => {
            preloadComponents(DRAWER_COMPONENTS);
        };

        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
            idleId = window.requestIdleCallback(warmDrawers, { timeout: 1200 });
        } else {
            timeoutId = window.setTimeout(warmDrawers, 220);
        }

        return () => {
            if (idleId && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
                window.cancelIdleCallback(idleId);
            }
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, []);

    return (
        <DrawerContext.Provider value={contextValue}>
            {children}
            <Suspense fallback={null}>
                {isStagingRuntimeTarget ? (
                    stagingDrawer
                ) : (
                    <>
                        <NewCustomerDrawer isOpen={activeDrawer === 'customer'} onClose={closeDrawer} />
                        <NewLoanDrawer isOpen={activeDrawer === 'loan'} onClose={closeDrawer} />
                        <NewPaymentDrawer isOpen={activeDrawer === 'payment'} onClose={closeDrawer} />
                    </>
                )}
            </Suspense>
        </DrawerContext.Provider>
    );
};

export const useDrawer = () => useContext(DrawerContext);
