import React, { useEffect } from 'react';

export default function Drawer({ isOpen, onClose, title, children }) {
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (!isOpen) {
            return undefined;
        }

        document.addEventListener('keydown', handleEscape);
        document.body.classList.add('drawer-open');

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.classList.remove('drawer-open');
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    const shortLabel = String(title || 'Nuevo').trim().charAt(0).toUpperCase() || 'N';

    return (
        <div className="drawer-overlay open" onClick={onClose}>
            <aside className="drawer open" onClick={(event) => event.stopPropagation()}>
                <span className="drawer-glow drawer-glow-top" />
                <span className="drawer-glow drawer-glow-bottom" />

                <header className="drawer-head">
                    <div className="drawer-title-group">
                        <div className="drawer-badge">{shortLabel}</div>
                        <div className="drawer-title-copy">
                            <p className="eyebrow">Flujo guiado</p>
                            <h3>{title}</h3>
                        </div>
                    </div>

                    <button type="button" className="drawer-close" onClick={onClose} aria-label="Cerrar panel">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                <div className="drawer-body">{children}</div>
            </aside>
        </div>
    );
}
