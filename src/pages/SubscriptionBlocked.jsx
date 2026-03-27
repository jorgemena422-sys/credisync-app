import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { formatDate, moneyWithCurrency } from '../utils/helpers';

function blockedCopy(status) {
    return 'El acceso al workspace esta bloqueado hasta regularizar la mensualidad. Cuando el super administrador reactive la suscripcion, el acceso volvera automaticamente.';
}

export default function SubscriptionBlocked() {
    const { logout } = useAuth();
    const { state } = useApp();
    const subscription = state?.subscription || {};

    return (
        <section className="view access-blocked-view">
            <div className="card access-blocked-card">
                <div className="access-blocked-badge">
                    <span className="material-symbols-outlined">lock</span>
                </div>
                <p className="eyebrow">Acceso restringido</p>
                <h2>Workspace bloqueado por suscripcion</h2>
                <p className="muted">{blockedCopy(subscription.status)}</p>

                <div className="access-blocked-grid">
                    <article className="access-blocked-metric">
                        <span className="muted small">Suscripcion</span>
                        <strong>{subscription.planName || 'CrediSync Mensual'}</strong>
                    </article>
                    <article className="access-blocked-metric">
                        <span className="muted small">Estado</span>
                        <strong>{String(subscription.status || 'suspended').replace('_', ' ')}</strong>
                    </article>
                    <article className="access-blocked-metric">
                        <span className="muted small">Mensualidad</span>
                        <strong>{moneyWithCurrency(subscription.priceMonthly || 0, subscription.currency || 'DOP')}</strong>
                    </article>
                    <article className="access-blocked-metric">
                        <span className="muted small">Proximo cobro</span>
                        <strong>{formatDate(subscription.nextBillingDate)}</strong>
                    </article>
                </div>

                <div className="action-group-inline">
                    <button type="button" className="btn btn-primary" onClick={logout}>
                        Cerrar sesion
                    </button>
                </div>
            </div>
        </section>
    );
}
