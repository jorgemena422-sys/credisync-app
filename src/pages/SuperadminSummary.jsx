import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { formatDate, moneyWithCurrency } from '../utils/helpers';
import { useSuperadminResource } from '../hooks/useSuperadminResource';

function SpotlightCard({ icon, label, value, note, tone = 'default' }) {
    return (
        <article className={`superadmin-spotlight superadmin-spotlight-${tone}`}>
            <div className="superadmin-spotlight-icon">
                <span className="material-symbols-outlined">{icon}</span>
            </div>
            <div>
                <p>{label}</p>
                <strong>{value}</strong>
                {note ? <span className="muted small">{note}</span> : null}
            </div>
        </article>
    );
}

function WorkspaceCard({ to, icon, title, description, meta }) {
    return (
        <Link to={to} className="superadmin-workspace-card">
            <div className="superadmin-workspace-icon">
                <span className="material-symbols-outlined">{icon}</span>
            </div>
            <div className="superadmin-workspace-copy">
                <strong>{title}</strong>
                <p>{description}</p>
                {meta ? <span className="muted small">{meta}</span> : null}
            </div>
        </Link>
    );
}

export default function SuperadminSummary() {
    const fetchUsers = useCallback(async () => {
        const response = await apiRequest('/superadmin/users');
        return Array.isArray(response?.users) ? response.users : [];
    }, []);

    const fetchSubscriptions = useCallback(async () => {
        const response = await apiRequest('/superadmin/subscriptions');
        return {
            subscriptions: Array.isArray(response?.subscriptions) ? response.subscriptions : [],
            plans: Array.isArray(response?.plans) ? response.plans : []
        };
    }, []);

    const fetchLogs = useCallback(async () => {
        const response = await apiRequest('/superadmin/audit-logs?limit=30');
        return Array.isArray(response?.logs) ? response.logs : [];
    }, []);

    const usersResource = useSuperadminResource('superadmin:users', fetchUsers, []);
    const billingResource = useSuperadminResource('superadmin:subscriptions:summary', fetchSubscriptions, { subscriptions: [], plans: [] });
    const logsResource = useSuperadminResource('superadmin:audit:recent', fetchLogs, []);

    const users = usersResource.data;
    const subscriptions = billingResource.data.subscriptions;
    const activePlan = billingResource.data.plans[0] || null;
    const logs = logsResource.data;
    const loading = usersResource.loading || billingResource.loading || logsResource.loading;
    const refreshing = usersResource.refreshing || billingResource.refreshing || logsResource.refreshing;

    const metrics = useMemo(() => {
        const paidStatuses = new Set(['paid', 'settled', 'completed']);
        const overdueStatuses = new Set(['overdue', 'pending', 'open']);
        const activeUsers = users.filter((item) => String(item.status || '').toLowerCase() === 'active').length;
        const activeTenants = subscriptions.filter((entry) => String(entry.subscription?.status || '').toLowerCase() === 'active').length;
        const suspendedTenants = subscriptions.filter((entry) => String(entry.subscription?.status || '').toLowerCase() === 'suspended').length;
        const collectionRisk = subscriptions.filter((entry) => {
            const subscriptionStatus = String(entry.subscription?.status || '').toLowerCase();
            const invoiceStatus = String(entry.latestInvoice?.status || '').toLowerCase();
            const overdueInvoicesCount = Number(entry.billing?.overdueInvoicesCount || 0);
            return subscriptionStatus === 'suspended' || overdueInvoicesCount > 0 || invoiceStatus === 'overdue';
        }).length;
        const estimatedMrr = subscriptions.reduce((sum, entry) => sum + Number(entry.subscription?.priceMonthly || 0), 0);
        const estimatedPending = subscriptions.reduce((sum, entry) => {
            const outstandingBalance = Number(entry.billing?.outstandingBalance || 0);
            if (outstandingBalance > 0) {
                return sum + outstandingBalance;
            }
            const invoiceStatus = String(entry.latestInvoice?.status || '').toLowerCase();
            if (!entry.latestInvoice || paidStatuses.has(invoiceStatus)) {
                return sum;
            }
            return overdueStatuses.has(invoiceStatus) ? sum + Number(entry.latestInvoice?.amount || 0) : sum;
        }, 0);

        return {
            activeUsers,
            activeTenants,
            suspendedTenants,
            collectionRisk,
            estimatedMrr,
            estimatedPending
        };
    }, [users, subscriptions]);

    const urgentAccounts = useMemo(() => {
        return subscriptions
            .filter((entry) => {
                const subscriptionStatus = String(entry.subscription?.status || '').toLowerCase();
                const invoiceStatus = String(entry.latestInvoice?.status || '').toLowerCase();
                const overdueInvoicesCount = Number(entry.billing?.overdueInvoicesCount || 0);
                return subscriptionStatus === 'suspended' || overdueInvoicesCount > 0 || invoiceStatus === 'overdue';
            })
            .slice(0, 4);
    }, [subscriptions]);

    const recentLogs = useMemo(() => logs.slice(0, 5), [logs]);

    if (loading && !users.length && !subscriptions.length && !logs.length) {
        return <section className="view"><div className="empty-state"><span className="material-symbols-outlined">hourglass_top</span><h4>Cargando centro superadmin...</h4></div></section>;
    }

    return (
        <section className="view superadmin-command-view">
            <div className="superadmin-command-hero card">
                <div className="superadmin-command-main">
                    <span className="eyebrow">Centro superadmin</span>
                    <h2>Un panel mas claro para operar el negocio</h2>
                    <p className="muted">
                        Aqui deberia quedar visible lo importante: cobros, acceso, tenants con riesgo y la mensualidad base del sistema.
                    </p>
                    <div className="action-group-inline">
                        <Link to="/superadmin/subscriptions?action=invoice" className="btn btn-primary">Nueva factura</Link>
                        <Link to="/superadmin/subscriptions?action=payment" className="btn btn-ghost">Registrar pago</Link>
                    </div>
                    {refreshing ? <p className="muted small">Actualizando indicadores...</p> : null}
                </div>

                <div className="superadmin-command-side">
                    <SpotlightCard
                        icon="payments"
                        label="Mensualidad base"
                        value={moneyWithCurrency(activePlan?.priceMonthly || 0, activePlan?.currency || 'DOP')}
                        note="Controlada desde Ajustes"
                        tone="primary"
                    />
                    <SpotlightCard
                        icon="monitoring"
                        label="MRR estimado"
                        value={moneyWithCurrency(metrics.estimatedMrr, activePlan?.currency || 'DOP')}
                        note={`${subscriptions.length} tenant(s) bajo el plan actual`}
                    />
                    <SpotlightCard
                        icon="warning"
                        label="Pendiente estimado"
                        value={moneyWithCurrency(metrics.estimatedPending, activePlan?.currency || 'DOP')}
                        note={metrics.collectionRisk > 0 ? `${metrics.collectionRisk} cuenta(s) requieren seguimiento` : 'Sin alertas de cobro ahora mismo'}
                        tone={metrics.collectionRisk > 0 ? 'warn' : 'good'}
                    />
                </div>
            </div>

            <div className="superadmin-kpi-band">
                <SpotlightCard icon="apartment" label="Activos" value={metrics.activeTenants} note="Tenants con acceso normal" />
                <SpotlightCard icon="lock" label="Suspendidos" value={metrics.suspendedTenants} note="Acceso bloqueado por falta de pago o accion manual" tone={metrics.suspendedTenants > 0 ? 'warn' : 'good'} />
                <SpotlightCard icon="group" label="Usuarios activos" value={metrics.activeUsers} note="Usuarios habilitados en el sistema" />
                <SpotlightCard icon="warning" label="Cobros vencidos" value={metrics.collectionRisk} note="Cuentas que requieren seguimiento" tone={metrics.collectionRisk > 0 ? 'warn' : 'good'} />
            </div>

            <div className="superadmin-workspace-grid">
                <WorkspaceCard
                    to="/superadmin/subscriptions"
                    icon="credit_card"
                    title="Cobros y suscripciones"
                    description="Revisa estados, proximos cobros y cuentas con pagos pendientes."
                    meta={`${metrics.collectionRisk} alerta(s) de cobro`}
                />
                <WorkspaceCard
                    to="/superadmin/tenants"
                    icon="domain"
                    title="Tenants y acceso"
                    description="Consulta owners, estado de acceso y situacion operativa por cuenta."
                    meta={`${metrics.suspendedTenants} suspendido(s)`}
                />
                <WorkspaceCard
                    to="/superadmin/users"
                    icon="group"
                    title="Usuarios globales"
                    description="Administra roles, acceso y recuperacion de cuentas."
                    meta={`${metrics.activeUsers} usuario(s) activos`}
                />
                <WorkspaceCard
                    to="/superadmin/settings"
                    icon="tune"
                    title="Configuracion global"
                    description="Ajusta mensualidad base, moneda y parametros de plataforma."
                    meta="Modelo de suscripcion y defaults"
                />
                <WorkspaceCard
                    to="/superadmin/audit"
                    icon="policy"
                    title="Auditoria"
                    description="Consulta cambios recientes y rastrea acciones administrativas."
                    meta={`${recentLogs.length} evento(s) recientes`}
                />
            </div>

            <div className="detail-grid">
                <div className="card section-stack">
                    <div className="section-head split">
                        <div>
                            <h4>Requieren atencion hoy</h4>
                            <p className="muted small">Casos prioritarios para cobro o acceso.</p>
                        </div>
                        <Link to="/superadmin/subscriptions" className="btn btn-ghost">Abrir gestion</Link>
                    </div>
                    <div className="superadmin-list">
                        {urgentAccounts.length > 0 ? urgentAccounts.map((entry) => (
                            <article key={entry.tenant.id} className="superadmin-list-item stack-item">
                                <div>
                                    <strong>{entry.tenant.name}</strong>
                                    <span className="muted small">{entry.tenant.ownerEmail || 'Sin owner asignado'}</span>
                                    <span className="muted small">
                                        Estado: {entry.subscription?.status || '-'}
                                        {entry.latestInvoice ? ` | Factura: ${entry.latestInvoice.status}` : ''}
                                    </span>
                                </div>
                                <Link to="/superadmin/subscriptions" className="btn btn-ghost">Gestionar</Link>
                            </article>
                        )) : <div className="empty-state compact-empty-state"><h4>Todo al dia</h4></div>}
                    </div>
                </div>

                <div className="card section-stack">
                    <div className="section-head split">
                        <div>
                            <h4>Actividad reciente</h4>
                            <p className="muted small">Ultimos movimientos administrativos.</p>
                        </div>
                        <Link to="/superadmin/audit" className="btn btn-ghost">Ver auditoria</Link>
                    </div>
                    <div className="superadmin-list">
                        {recentLogs.length > 0 ? recentLogs.map((item) => (
                            <article key={item.id} className="superadmin-list-item stack-item">
                                <div>
                                    <strong>{item.action || 'Evento'}</strong>
                                    <span className="muted small">{item.entityType || 'sistema'} | {item.entityId || '-'}</span>
                                    <span className="muted small">{formatDate(item.createdAt)}</span>
                                </div>
                            </article>
                        )) : <div className="empty-state compact-empty-state"><h4>Sin actividad reciente</h4></div>}
                    </div>
                </div>
            </div>
        </section>
    );
}
