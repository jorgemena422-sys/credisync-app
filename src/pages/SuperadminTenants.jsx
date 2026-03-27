import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { formatDate, moneyWithCurrency } from '../utils/helpers';
import { statusTag } from './Dashboard';
import { invalidateSuperadminResource, useSuperadminResource } from '../hooks/useSuperadminResource';
import { useToast } from '../context/ToastContext';

export default function SuperadminTenants() {
    const { showToast } = useToast();
    const [query, setQuery] = useState('');
    const [deletingTenantId, setDeletingTenantId] = useState('');

    const fetchSubscriptions = useCallback(async () => {
        const response = await apiRequest('/superadmin/subscriptions');
        return Array.isArray(response?.subscriptions) ? response.subscriptions : [];
    }, []);

    const subscriptionsResource = useSuperadminResource('superadmin:subscriptions', fetchSubscriptions, []);
    const rows = subscriptionsResource.data;
    const loading = subscriptionsResource.loading;
    const refreshing = subscriptionsResource.refreshing;

    const filteredRows = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return rows.filter((entry) => {
            const haystack = `${entry.tenant?.name || ''} ${entry.tenant?.ownerEmail || ''} ${entry.subscription?.status || ''}`.toLowerCase();
            return !normalizedQuery || haystack.includes(normalizedQuery);
        });
    }, [rows, query]);

    const deleteTenant = async (entry) => {
        if (!entry?.tenant?.id || entry.tenant?.isProtected) {
            showToast('Este tenant esta protegido y no puede eliminarse');
            return;
        }

        const tenantName = entry.tenant?.name || entry.tenant.id;
        const confirmed = window.confirm(`Eliminar el tenant "${tenantName}"? Esta accion borrara usuarios y datos asociados de forma permanente.`);
        if (!confirmed) {
            return;
        }

        try {
            setDeletingTenantId(entry.tenant.id);
            await apiRequest(`/superadmin/tenants/${entry.tenant.id}`, { method: 'DELETE' });
            invalidateSuperadminResource('superadmin:subscriptions');
            invalidateSuperadminResource('superadmin:subscriptions:bundle');
            invalidateSuperadminResource('superadmin:subscriptions:summary');
            await subscriptionsResource.refresh();
            showToast('Tenant eliminado correctamente');
        } catch (error) {
            showToast(error.message || 'No se pudo eliminar el tenant');
        } finally {
            setDeletingTenantId('');
        }
    };

    if (loading) {
        return <section className="view"><div className="empty-state"><span className="material-symbols-outlined">hourglass_top</span><h4>Cargando tenants...</h4></div></section>;
    }

    return (
        <section className="view">
            <div className="card section-stack superadmin-toolbar">
                <div>
                    <h2>Tenants y acceso</h2>
                    <p className="muted">Vista operacional por cuenta: owner, estado de suscripcion y situacion de cobro.</p>
                    {refreshing && <p className="muted small">Actualizando tenants...</p>}
                </div>
                <input
                    className="superadmin-search"
                    placeholder="Buscar por tenant, owner o estado"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>

            <div className="card section-stack">
                <div className="table-wrap superadmin-tenants-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Tenant</th>
                                <th>Owner</th>
                                <th>Mensualidad</th>
                                <th>Acceso</th>
                                <th>Ultima factura</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length > 0 ? filteredRows.map((entry) => (
                                <tr key={entry.tenant.id}>
                                    <td data-label="Tenant">
                                        <div className="cell-stack">
                                            <strong>{entry.tenant.name}</strong>
                                            {entry.tenant?.isProtected ? <span className="muted small">Protegido</span> : null}
                                            <span className="tiny">{entry.tenant.id}</span>
                                            <span className="muted small">Alta: {formatDate(entry.tenant.createdAt)}</span>
                                        </div>
                                    </td>
                                    <td data-label="Owner">
                                        <div className="cell-stack">
                                            <strong>{entry.tenant.ownerName || 'Sin owner'}</strong>
                                            <span>{entry.tenant.ownerEmail || '-'}</span>
                                        </div>
                                    </td>
                                    <td data-label="Mensualidad">{moneyWithCurrency(entry.subscription?.priceMonthly || 0, entry.subscription?.currency || 'DOP')}</td>
                                    <td data-label="Acceso">{statusTag(entry.subscription?.status)}</td>
                                    <td data-label="Ultima factura">
                                        {entry.latestInvoice
                                            ? `${entry.latestInvoice.status} | ${moneyWithCurrency(entry.latestInvoice.amount, entry.latestInvoice.currency || entry.subscription?.currency || 'DOP')}`
                                            : '-'}
                                    </td>
                                    <td data-label="Acciones">
                                        <div className="action-group-inline">
                                            <Link className="action-link" to={`/superadmin/audit/${entry.tenant.id}`}>Auditar</Link>
                                            <Link className="action-link" to="/superadmin/subscriptions">Cobros</Link>
                                            {!entry.tenant?.isProtected ? (
                                                <button
                                                    type="button"
                                                    className="action-link action-link-danger"
                                                    onClick={() => deleteTenant(entry)}
                                                    disabled={deletingTenantId === entry.tenant.id}
                                                >
                                                    {deletingTenantId === entry.tenant.id ? 'Eliminando...' : 'Eliminar'}
                                                </button>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr className="empty-row"><td colSpan="6"><div className="empty-state compact-empty-state"><h4>No hay tenants</h4></div></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
