import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext({ showToast: () => { } });

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState({ message: '', visible: false });
    const timerRef = useRef(null);

    const showToast = useCallback((message) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setToast({ message, visible: true });

        timerRef.current = setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 2500);
    }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const contextValue = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            <div id="toast" className={`toast ${!toast.visible ? 'hidden' : ''}`} role="status" aria-live="polite">
                {toast.message}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => useContext(ToastContext);
