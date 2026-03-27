import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatDate, moneyWithCurrency } from '../utils/helpers';
import { statusTag } from './Dashboard';
import { invalidateSuperadminResource, setSuperadminResource, useSuperadminResource } from '../hooks/useSuperadminResource';
import SuperadminTenantBillingDrawer from '../components/SuperadminTenantBillingDrawer';

export default function SuperadminSubscriptions() {
    const { showToast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [savingTenantId, setSavingTenantId] = useState('');
    const [query, setQuery] = useState('');
    const [drafts, setDrafts] = useState({});
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [drawerInitialTab, setDrawerInitialTab] = useState('');
    const [quickActionTenantId, setQuickActionTenantId] = useState('');

    const fetchSubscriptions = useCallback(async () => {
        const response = await apiRequest('/superadmin/subscriptions');
        const bundle = {
            rows: Array.isArray(response?.subscriptions) ? response.subscriptions : [],
            plans: Array.isArray(response?.plans) ? response.plans : []
        };
        setSuperadminResource('superadmin:subscriptions', bundle.rows);
        setSuperadminResource('superadmin:plans', bundle.plans);
        return bundle;
    }, []);

    const subscriptionsResource = useSuperadminResource('superadmin:subscriptions:bundle', fetchSubscriptions, { rows: [], plans: [] });
    const rows = subscriptionsResource.data.rows;
    const plan = subscriptionsResource.data.plans[0] || null;
    const loading = subscriptionsResource.loading;
    const refreshing = subscriptionsResource.refreshing;
    const quickAction = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const action = String(params.get('action') || '').trim().toLowerCase();
        return action === 'invoice' || action === 'payment' ? action : '';
    }, [location.search]);

    useEffect(() => {
        const nextDrafts = {};
        rows.forEach((entry) => {
            nextDrafts[entry.tenant.id] = {
                status: entry.subscription?.status || 'active',
                nextBillingDate: entry.subscription?.nextBillingDate || '',
                notes: entry.subscription?.notes || ''
            };
        });
        setDrafts(nextDrafts);
    }, [rows]);

    const quickActionCandidates = useMemo(() => {
        const payableStatuses = new Set(['pending', 'overdue']);
        return rows.map((entry) => {
            const latestInvoiceStatus = String(entry.latestInvoice?.status || '').toLowerCase();
            const outstandingBalance = Number(entry.billing?.outstandingBalance || 0);
            return {
                tenantId: entry.tenant.id,
                tenantName: entry.tenant?.name || entry.tenant.id,
                ownerEmail: entry.tenant?.ownerEmail || '',
                hasPayableInvoice: outstandingBalance > 0.009 || payableStatuses.has(latestInvoiceStatus)
            };
        });
    }, [rows]);

    useEffect(() => {
        if (!quickAction) {
            setQuickActionTenantId('');
            return;
        }

        const preferredCandidate = quickAction === 'payment'
            ? quickActionCandidates.find((item) => item.hasPayableInvoice) || quickActionCandidates[0]
            : quickActionCandidates[0];

        setQuickActionTenantId((current) => {
            if (current && quickActionCandidates.some((item) => item.tenantId === current)) {
                return current;
            }
            return preferredCandidate?.tenantId || '';
        });
    }, [quickAction, quickActionCandidates]);

    const filtered = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return rows.filter((entry) => {
            const haystack = `${entry.tenant?.name || ''} ${entry.tenant?.ownerEmail || ''} ${entry.subscription?.status || ''}`.toLowerCase();
            return !normalizedQuery || haystack.includes(normalizedQuery);
        });
    }, [rows, query]);

    const updateDraft = (tenantId, field, value) => {
        setDrafts((prev) => ({
            ...prev,
            [tenantId]: {
                ...(prev[tenantId] || {}),
                [field]: value
            }
        }));
    };

    const updateSubscription = async (tenantId) => {
        try {
            setSavingTenantId(tenantId);
            await apiRequest(`/superadmin/tenants/${tenantId}/subscription`, {
                method: 'PUT',
                body: drafts[tenantId] || {}
            });
            invalidateSuperadminResource('superadmin:subscriptions:bundle');
            invalidateSuperadminResource('superadmin:subscriptions');
            await subscriptionsResource.refresh();
            showToast('Suscripcion actualizada');
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar la suscripcion');
        } finally {
            setSavingTenantId('');
        }
    };

    const refreshSubscriptions = useCallback(async () => {
        invalidateSuperadminResource('superadmin:subscriptions:bundle');
        invalidateSuperadminResource('superadmin:subscriptions');
        invalidateSuperadminResource('superadmin:subscriptions:summary');
        await subscriptionsResource.refresh();
    }, [subscriptionsResource]);

    const clearQuickAction = useCallback(() => {
        const params = new URLSearchParams(location.search);
        params.delete('action');
        const nextSearch = params.toString();
        navigate(
            {
                pathname: location.pathname,
                search: nextSearch ? `?${nextSearch}` : ''
            },
            { replace: true }
        );
    }, [location.pathname, location.search, navigate]);

    const selectedQuickActionTenant = useMemo(() => {
        return quickActionCandidates.find((item) => item.tenantId === quickActionTenantId) || null;
    }, [quickActionCandidates, quickActionTenantId]);

    const openQuickActionDrawer = () => {
        if (!quickAction || !quickActionTenantId) {
            showToast('Selecciona un tenant para continuar');
            return;
        }

        setDrawerInitialTab(quickAction);
        setSelectedTenantId(quickActionTenantId);
    };

    if (loading) {
        return <section className="view"><div className="empty-state"><span className="material-symbols-outlined">hourglass_top</span><h4>Cargando suscripciones...</h4></div></section>;
    }

    return (
        <section className="view">
            <div className="card section-stack superadmin-toolbar">
                <div>
                    <h2>Suscripciones y cobros</h2>
                    <p className="muted">Modelo unificado de suscripcion mensual. Si una cuenta no esta habilitada, su acceso queda bloqueado.</p>
                    <p className="muted small">Mensualidad base actual: {moneyWithCurrency(plan?.priceMonthly || 0, plan?.currency || 'DOP')}</p>
                    {refreshing && <p className="muted small">Actualizando suscripciones...</p>}
                </div>
                <input
                    className="superadmin-search"
                    placeholder="Buscar por tenant, owner o estado"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>

            {quickAction ? (
                <div className="card section-stack superadmin-quick-launch">
                    <div className="section-head split">
                        <div>
                            <h4>{quickAction === 'invoice' ? 'Acceso rapido para nueva factura' : 'Acceso rapido para registrar pago'}</h4>
                            <p className="muted small">
                                {quickAction === 'invoice'
                                    ? 'Selecciona el tenant y abre directo el panel para generar la factura.'
                                    : 'Selecciona el tenant y abre directo el panel para registrar el pago confirmado.'}
                            </p>
                        </div>
                        <button type="button" className="btn btn-ghost" onClick={clearQuickAction}>Cerrar</button>
                    </div>

                    <div className="superadmin-quick-launch-grid">
                        <div className="form-group">
                            <label>Tenant</label>
                            <select
                                value={quickActionTenantId}
                                onChange={(event) => setQuickActionTenantId(event.target.value)}
                            >
                                {quickActionCandidates.map((item) => (
                                    <option key={item.tenantId} value={item.tenantId}>
                                        {item.ownerEmail ? `${item.tenantName} · ${item.ownerEmail}` : item.tenantName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="superadmin-quick-launch-summary">
                            <strong>{selectedQuickActionTenant?.tenantName || 'Selecciona un tenant'}</strong>
                            <p className="muted small">
                                {quickAction === 'payment'
                                    ? selectedQuickActionTenant?.hasPayableInvoice
                                        ? 'Este tenant tiene al menos una factura pendiente o vencida lista para cobrar.'
                                        : 'Puedes abrir el panel, pero si no hay factura pendiente no se podra registrar un pago.'
                                    : 'Abriremos el panel listo para generar una nueva factura.'}
                            </p>
                        </div>

                        <div className="superadmin-quick-launch-actions">
                            <button type="button" className="btn btn-primary" onClick={openQuickActionDrawer} disabled={!quickActionTenantId}>
                                {quickAction === 'invoice' ? 'Abrir generador de factura' : 'Abrir registro de pago'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="card section-stack">
                <div className="table-wrap superadmin-subscriptions-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Tenant</th>
                                <th>Mensualidad</th>
                                <th>Estado</th>
                                <th>Fecha de suspension</th>
                                <th>Ultima factura</th>
                                <th>Control</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length > 0 ? filtered.map((entry) => {
                                const draft = drafts[entry.tenant.id] || {};
                                return (
                                    <tr key={entry.tenant.id}>
                                        <td data-label="Tenant">
                                            <div className="cell-stack">
                                                <strong>{entry.tenant.name}</strong>
                                                <span>{entry.tenant.ownerEmail || '-'}</span>
                                            </div>
                                        </td>
                                        <td data-label="Mensualidad">{moneyWithCurrency(entry.subscription?.priceMonthly || 0, entry.subscription?.currency || 'DOP')}</td>
                                        <td data-label="Estado">{statusTag(entry.subscription?.status)}</td>
                                        <td data-label="Fecha de suspension">{formatDate(entry.subscription?.nextBillingDate)}</td>
                                        <td data-label="Ultima factura">{entry.latestInvoice ? `${moneyWithCurrency(entry.latestInvoice.amount, entry.latestInvoice.currency || entry.subscription?.currency || 'DOP')} · ${entry.latestInvoice.status}` : '-'}</td>
                                        <td data-label="Control">
                                            <div className="superadmin-subscription-editor">
                                                <select
                                                    className="superadmin-subscription-field"
                                                    value={draft.status || entry.subscription?.status || 'active'}
                                                    onChange={(event) => updateDraft(entry.tenant.id, 'status', event.target.value)}
                                                    disabled={savingTenantId === entry.tenant.id}
                                                >
                                                    <option value="active">Activa</option>
                                                    <option value="suspended">Suspendida</option>
                                                </select>
                                                <input
                                                    className="superadmin-subscription-field"
                                                    type="date"
                                                    value={draft.nextBillingDate || ''}
                                                    onChange={(event) => updateDraft(entry.tenant.id, 'nextBillingDate', event.target.value)}
                                                    disabled={savingTenantId === entry.tenant.id}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-primary superadmin-subscription-save"
                                                    onClick={() => updateSubscription(entry.tenant.id)}
                                                    disabled={savingTenantId === entry.tenant.id}
                                                >
                                                    {savingTenantId === entry.tenant.id ? 'Guardando...' : 'Guardar'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost superadmin-subscription-detail"
                                                    onClick={() => {
                                                        setDrawerInitialTab('');
                                                        setSelectedTenantId(entry.tenant.id);
                                                    }}
                                                    disabled={savingTenantId === entry.tenant.id}
                                                >
                                                    Detalle
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr className="empty-row"><td colSpan="6"><div className="empty-state compact-empty-state"><h4>Sin suscripciones</h4></div></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <SuperadminTenantBillingDrawer
                isOpen={Boolean(selectedTenantId)}
                tenantId={selectedTenantId}
                initialTab={drawerInitialTab}
                onClose={() => {
                    setSelectedTenantId('');
                    setDrawerInitialTab('');
                }}
                onSaved={refreshSubscriptions}
            />
        </section>
    );
}
