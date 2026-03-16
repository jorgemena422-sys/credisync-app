import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatDate, money } from '../utils/helpers';

function subscriptionStatusLabel(value) {
    const status = String(value || '').toLowerCase();
    if (status === 'trial') return 'Prueba';
    if (status === 'active') return 'Activa';
    if (status === 'past_due') return 'Pendiente';
    if (status === 'suspended') return 'Suspendida';
    if (status === 'cancelled') return 'Cancelada';
    return value || '-';
}

export default function SuperadminSubscriptions() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]);
    const [plans, setPlans] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showOrphans, setShowOrphans] = useState(false);
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [detailLoading, setDetailLoading] = useState(false);
    const [detail, setDetail] = useState(null);
    const [subscriptionForm, setSubscriptionForm] = useState({
        planId: '',
        status: 'trial',
        notes: ''
    });

    const loadSubscriptions = async () => {
        try {
            setLoading(true);
            const response = await apiRequest('/superadmin/subscriptions');
            const incomingSubscriptions = Array.isArray(response?.subscriptions) ? response.subscriptions : [];
            const incomingPlans = Array.isArray(response?.plans) ? response.plans : [];

            setSubscriptions(incomingSubscriptions);
            setPlans(incomingPlans);

            const fallbackSelection = incomingSubscriptions.find((item) => showOrphans || Number(item.tenant?.usersCount || 0) > 0)
                || incomingSubscriptions[0]
                || null;

            if (!selectedTenantId && fallbackSelection) {
                setSelectedTenantId(fallbackSelection.tenant.id);
            }

            const stillExists = incomingSubscriptions.some((item) => item.tenant.id === selectedTenantId);
            if (selectedTenantId && !stillExists && fallbackSelection) {
                setSelectedTenantId(fallbackSelection.tenant.id);
            }
        } catch (error) {
            showToast(error.message || 'No fue posible cargar suscripciones');
        } finally {
            setLoading(false);
        }
    };

    const loadTenantDetail = async (tenantId) => {
        if (!tenantId) {
            setDetail(null);
            return;
        }

        try {
            setDetailLoading(true);
            const response = await apiRequest(`/superadmin/tenants/${tenantId}/subscription`);
            setDetail(response);
            const subscription = response?.subscription || {};
            setSubscriptionForm({
                planId: subscription.planId || '',
                status: subscription.status || 'trial',
                notes: subscription.notes || ''
            });
        } catch (error) {
            setDetail(null);
            showToast(error.message || 'No fue posible cargar el detalle del tenant');
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        loadSubscriptions();
    }, []);

    useEffect(() => {
        if (selectedTenantId) {
            loadTenantDetail(selectedTenantId);
        }
    }, [selectedTenantId]);

    useEffect(() => {
        if (showOrphans) {
            return;
        }

        const selected = subscriptions.find((item) => item.tenant.id === selectedTenantId) || null;
        if (selected && Number(selected.tenant?.usersCount || 0) > 0) {
            return;
        }

        const replacement = subscriptions.find((item) => Number(item.tenant?.usersCount || 0) > 0) || null;
        if (replacement && replacement.tenant.id !== selectedTenantId) {
            setSelectedTenantId(replacement.tenant.id);
        }
    }, [showOrphans, subscriptions, selectedTenantId]);

    const filteredSubscriptions = useMemo(() => {
        return subscriptions.filter((item) => {
            if (!showOrphans && Number(item.tenant?.usersCount || 0) <= 0) {
                return false;
            }

            if (statusFilter !== 'all') {
                const statusMatches = String(item.subscription?.status || '').toLowerCase() === statusFilter;
                if (!statusMatches) return false;
            }

            const query = String(searchTerm || '').trim().toLowerCase();
            if (!query) return true;

            const haystack = [
                item.tenant?.name,
                item.tenant?.id,
                item.tenant?.ownerName,
                item.tenant?.ownerEmail
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(query);
        });
    }, [subscriptions, statusFilter, searchTerm, showOrphans]);

    const saveSubscription = async (event) => {
        event.preventDefault();
        if (!selectedTenantId) return;

        if (Number(detail?.tenant?.usersCount || 0) <= 0) {
            showToast('Este tenant no tiene usuarios asociados. Primero debes asignar un usuario.');
            return;
        }

        try {
            setSaving(true);
            await apiRequest(`/superadmin/tenants/${selectedTenantId}/subscription`, {
                method: 'PUT',
                body: {
                    planId: subscriptionForm.planId,
                    status: subscriptionForm.status,
                    notes: subscriptionForm.notes
                }
            });
            showToast('Plan y estado actualizados');
            await Promise.all([loadSubscriptions(), loadTenantDetail(selectedTenantId)]);
        } catch (error) {
            showToast(error.message || 'No fue posible actualizar la suscripcion');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="view">
            <div className="card section-stack superadmin-head">
                <div className="section-head split">
                    <div>
                        <h3>Suscripciones</h3>
                        <p className="muted">Cambia el plan y estado de cada tenant. La gestión de cobro se realiza internamente.</p>
                    </div>
                    <div className="superadmin-row-actions">
                        <input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Buscar por tenant, ID o correo"
                        />
                        <label className="superadmin-toggle-row">
                            <input type="checkbox" checked={showOrphans} onChange={(event) => setShowOrphans(event.target.checked)} />
                            <div><strong>Mostrar huérfanos</strong></div>
                        </label>
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="all">Todos los estados</option>
                            <option value="trial">Prueba</option>
                            <option value="active">Activos</option>
                            <option value="past_due">Pendientes</option>
                            <option value="suspended">Suspendidos</option>
                            <option value="cancelled">Cancelados</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="superadmin-layout">
                <div className="card section-stack superadmin-main-panel">
                    <div className="section-head split">
                        <h3>Tenants suscritos</h3>
                        <span className="muted small">{filteredSubscriptions.length} tenant(s)</span>
                    </div>
                    {loading ? (
                        <div className="empty-state compact-empty-state"><h4>Cargando suscripciones...</h4></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Tenant</th>
                                        <th>Administrador</th>
                                        <th>Usuarios</th>
                                        <th>Plan</th>
                                        <th>Estado</th>
                                        <th>Renovacion</th>
                                        <th>Accion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubscriptions.length > 0 ? filteredSubscriptions.map((item) => (
                                        <tr key={item.tenant.id} className={selectedTenantId === item.tenant.id ? 'superadmin-row-active' : ''}>
                                            <td data-label="Tenant">
                                                <div className="cell-stack">
                                                    <strong>{item.tenant.name}</strong>
                                                    <span className="muted small">{item.tenant.id}</span>
                                                </div>
                                            </td>
                                            <td data-label="Administrador">
                                                <div className="cell-stack">
                                                    <strong>{item.tenant.ownerName || '-'}</strong>
                                                    <span className="muted small">{item.tenant.ownerEmail || 'Sin usuario asociado'}</span>
                                                </div>
                                            </td>
                                            <td data-label="Usuarios">{Number(item.tenant.usersCount || 0)}</td>
                                            <td data-label="Plan">{item.subscription.planName}</td>
                                            <td data-label="Estado"><span className={`status status-${item.subscription.status === 'active' ? 'active' : item.subscription.status === 'trial' ? 'pending' : 'inactive'}`}>{subscriptionStatusLabel(item.subscription.status)}</span></td>
                                            <td data-label="Renovacion">{formatDate(item.subscription.nextBillingDate)}</td>
                                            <td data-label="Accion">
                                                {Number(item.tenant?.usersCount || 0) > 0 ? (
                                                    <button type="button" className="action-link" onClick={() => setSelectedTenantId(item.tenant.id)}>
                                                        Gestionar
                                                    </button>
                                                ) : (
                                                    <span className="muted small">Sin usuarios</span>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr className="empty-row"><td colSpan="7"><div className="empty-state compact-empty-state"><h4>Sin resultados</h4></div></td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <aside className="card section-stack superadmin-side-panel">
                    <div className="section-head">
                        <h3>Configurar suscripcion</h3>
                    </div>
                    {detailLoading ? (
                        <div className="empty-state compact-empty-state"><h4>Cargando detalle...</h4></div>
                    ) : detail ? (
                        <form className="form-section" onSubmit={saveSubscription}>
                            <label>Tenant</label>
                            <input value={detail?.tenant?.name || ''} readOnly />
                            <p className="muted small">{detail?.tenant?.id || '-'}</p>
                            <p className="muted small">Admin: {detail?.tenant?.ownerEmail || '-'}</p>

                            {Number(detail?.tenant?.usersCount || 0) <= 0 && (
                                <p className="muted small">Este tenant no tiene usuarios asociados. Los cambios de plan no impactaran cuentas hasta asignar un usuario.</p>
                            )}

                            <label>Plan</label>
                            <select
                                value={subscriptionForm.planId}
                                onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, planId: event.target.value }))}
                                disabled={Number(detail?.tenant?.usersCount || 0) <= 0}
                            >
                                {(detail.plans || plans).map((plan) => (
                                    <option key={plan.id} value={plan.id}>{plan.name} ({money(plan.priceMonthly)})</option>
                                ))}
                            </select>

                            <label>Estado</label>
                            <select
                                value={subscriptionForm.status}
                                onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, status: event.target.value }))}
                                disabled={Number(detail?.tenant?.usersCount || 0) <= 0}
                            >
                                <option value="trial">Prueba</option>
                                <option value="active">Activa</option>
                                <option value="past_due">Pendiente</option>
                                <option value="suspended">Suspendida</option>
                                <option value="cancelled">Cancelada</option>
                            </select>

                            <div className="card section-stack">
                                <p className="muted small">Inicio periodo: {formatDate(detail.subscription?.currentPeriodStart)}</p>
                                <p className="muted small">Fin periodo: {formatDate(detail.subscription?.currentPeriodEnd)}</p>
                                <p className="muted small">Proximo cobro: {formatDate(detail.subscription?.nextBillingDate)}</p>
                                <p className="muted small">Fin prueba: {formatDate(detail.subscription?.trialEndsAt)}</p>
                            </div>

                            <label>Notas</label>
                            <textarea
                                rows={3}
                                value={subscriptionForm.notes}
                                onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, notes: event.target.value }))}
                                disabled={Number(detail?.tenant?.usersCount || 0) <= 0}
                            />

                            <button type="submit" className="btn btn-primary" disabled={saving || Number(detail?.tenant?.usersCount || 0) <= 0}>
                                {saving ? 'Guardando...' : 'Guardar suscripcion'}
                            </button>
                        </form>
                    ) : (
                        <div className="empty-state compact-empty-state"><h4>Selecciona un tenant</h4></div>
                    )}
                </aside>
            </div>
        </section>
    );
}
