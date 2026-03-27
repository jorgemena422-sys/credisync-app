import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './styles.css';

const CHUNK_RELOAD_FLAG = 'credisync-chunk-reload-once';

function shouldReloadForChunkError(errorLike) {
    const message = String(
        errorLike?.message
        || errorLike?.reason?.message
        || errorLike?.target?.src
        || ''
    ).toLowerCase();

    return message.includes('failed to fetch dynamically imported module')
        || message.includes('importing a module script failed')
        || message.includes('loading chunk')
        || (message.includes('/assets/') && message.includes('.js'));
}

function ChunkLoadRecovery() {
    useEffect(() => {
        sessionStorage.removeItem(CHUNK_RELOAD_FLAG);

        const reloadOnce = () => {
            if (sessionStorage.getItem(CHUNK_RELOAD_FLAG) === '1') {
                return;
            }

            sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
            window.location.reload();
        };

        const handleError = (event) => {
            if (shouldReloadForChunkError(event.error || event)) {
                reloadOnce();
            }
        };

        const handleUnhandledRejection = (event) => {
            if (shouldReloadForChunkError(event.reason || event)) {
                reloadOnce();
            }
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    return null;
}

function ViewportZoomLock() {
    useEffect(() => {
        const preventGesture = (event) => {
            event.preventDefault();
        };

        let lastTouchEnd = 0;
        const preventDoubleTapZoom = (event) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        };

        const preventPinchZoom = (event) => {
            if (event.scale && event.scale !== 1) {
                event.preventDefault();
            }
        };

        const preventTrackpadPinch = (event) => {
            if (event.ctrlKey) {
                event.preventDefault();
            }
        };

        document.addEventListener('gesturestart', preventGesture, { passive: false });
        document.addEventListener('gesturechange', preventGesture, { passive: false });
        document.addEventListener('gestureend', preventGesture, { passive: false });
        document.addEventListener('touchmove', preventPinchZoom, { passive: false });
        document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
        window.addEventListener('wheel', preventTrackpadPinch, { passive: false });

        return () => {
            document.removeEventListener('gesturestart', preventGesture);
            document.removeEventListener('gesturechange', preventGesture);
            document.removeEventListener('gestureend', preventGesture);
            document.removeEventListener('touchmove', preventPinchZoom);
            document.removeEventListener('touchend', preventDoubleTapZoom);
            window.removeEventListener('wheel', preventTrackpadPinch);
        };
    }, []);

    return null;
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <ChunkLoadRecovery />
                <ViewportZoomLock />
                <App />
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);

