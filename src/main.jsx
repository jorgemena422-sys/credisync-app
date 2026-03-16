import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './styles.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        } catch {
            // keep app boot resilient if service worker fails
        }
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
        const payload = event && event.data ? event.data : {};
        if (payload.type === 'OPEN_URL' && payload.url) {
            window.location.href = String(payload.url);
        }
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);
