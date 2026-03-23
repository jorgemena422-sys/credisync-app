import React, { useEffect, useState } from 'react';
import { applyAppUpdate, registerAppServiceWorker } from '../utils/serviceWorker';

export default function AppUpdateBanner() {
    const [updateRegistration, setUpdateRegistration] = useState(null);
    const [isApplying, setIsApplying] = useState(false);

    useEffect(() => registerAppServiceWorker({
        onUpdateReady: (registration) => {
            setUpdateRegistration(registration);
            setIsApplying(false);
        },
        onOpenUrl: (url) => {
            window.location.href = url;
        }
    }), []);

    if (!updateRegistration?.waiting) {
        return null;
    }

    const handleApplyUpdate = () => {
        setIsApplying(true);

        if (!applyAppUpdate(updateRegistration)) {
            setIsApplying(false);
        }
    };

    return (
        <div className="app-update-banner" role="status" aria-live="polite">
            <div>
                <p className="app-update-banner-title">Nueva version disponible</p>
                <p className="app-update-banner-copy">Actualiza la app para recibir los cambios mas recientes.</p>
            </div>
            <button type="button" className="btn btn-primary app-update-banner-btn" onClick={handleApplyUpdate} disabled={isApplying}>
                {isApplying ? 'Actualizando...' : 'Actualizar'}
            </button>
        </div>
    );
}
