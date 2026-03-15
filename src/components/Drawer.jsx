import React, { useEffect, useMemo } from 'react';

function getDrawerBadge(title) {
    if (!title) return 'CS';
    const parts = title
        .split(' ')
        .map(part => part.trim())
        .filter(Boolean);

    return parts.slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'CS';
}

export default function Drawer({ isOpen, onClose, title, children, className = '' }) {
    const badge = useMemo(() => getDrawerBadge(title), [title]);

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('drawer-open');
        } else {
            document.body.classList.remove('drawer-open');
        }
        return () => document.body.classList.remove('drawer-open');
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) {
        return (
            <>
                <div className="drawer-overlay" />
                <aside className="drawer" aria-hidden="true" />
            </>
        );
    }

    return (
        <>
            <div
                className={`drawer-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <aside
                className={`drawer ${className} ${isOpen ? 'open' : ''}`.trim()}
                aria-hidden={!isOpen}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <div className="drawer-glow drawer-glow-top" aria-hidden="true" />
                <div className="drawer-glow drawer-glow-bottom" aria-hidden="true" />
                <div className="drawer-head">
                    <div className="drawer-title-group">
                        <div className="drawer-badge" aria-hidden="true">{badge}</div>
                        <div className="drawer-title-copy">
                            <p className="eyebrow">Panel lateral</p>
                            <h3>{title}</h3>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="drawer-close"
                        onClick={onClose}
                        aria-label="Cerrar panel"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="drawer-body">
                    {children}
                </div>
            </aside>
        </>
    );
}
