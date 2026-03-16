import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/helpers';

function aggregateTenants(users) {
    const map = new Map();

    users.forEach((user) => {
        if (!user.tenantId) return;
        const current = map.get(user.tenantId) || {
            id: user.tenantId,
            name: user.tenantName || 'Tenant sin nombre',
            status: user.tenantStatus || 'inactive',
            users: [],
            createdAt: user.createdAt || null,
            lastAccess: null
        };

        current.users.push(user);
        if (!current.createdAt || new Date(user.createdAt || 0).getTime() < new Date(current.createdAt || 0).getTime()) {
            current.createdAt = user.createdAt || current.createdAt;
        }
        const candidate = user.lastSignInAt || user.lastLoginAt || user.createdAt || null;
        if (!current.lastAccess || new Date(candidate || 0).getTime() > new Date(current.lastAccess || 0).getTime()) {
            current.lastAccess = candidate;
        }

        map.set(user.tenantId, current);
    });

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function SuperadminTenants() {
    const { superadminUsers } = useApp();

    const tenants = useMemo(() => aggregateTenants(superadminUsers || []), [superadminUsers]);

    return (
        <section className="view">
            <div className="card section-stack superadmin-head">
                <div className="section-head split">
                    <div>
                        <h3>Tenants</h3>
                        <p className="muted">Explora los workspaces creados y entra a su auditoria operativa.</p>
                    </div>
                    <span className="status status-active">{tenants.length} workspace(s)</span>
                </div>
            </div>

            <div className="card section-stack">
                <div className="section-head split">
                    <div>
                        <h3>Directorio de tenants</h3>
                        <p className="muted">Cada fila agrupa el estado del tenant y su usuario administrador principal.</p>
                    </div>
                </div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Tenant</th>
                                <th>Estado</th>
                                <th>Usuarios</th>
                                <th>Administrador principal</th>
                                <th>Ultimo acceso</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.length > 0 ? tenants.map((tenant) => {
                                const owner = tenant.users[0];
                                return (
                                    <tr key={tenant.id}>
                                        <td data-label="Tenant">
                                            <div className="cell-stack">
                                                <strong>{tenant.name}</strong>
                                                <span className="muted small"><code>{tenant.id}</code></span>
                                            </div>
                                        </td>
                                        <td data-label="Estado"><span className={`status status-${tenant.status}`}>{tenant.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                                        <td data-label="Usuarios">{tenant.users.length}</td>
                                        <td data-label="Administrador principal">
                                            <div className="cell-stack">
                                                <strong>{owner?.name || owner?.email || '-'}</strong>
                                                <span className="muted small">Alta: {formatDate(tenant.createdAt)}</span>
                                            </div>
                                        </td>
                                        <td data-label="Ultimo acceso">{formatDate(tenant.lastAccess)}</td>
                                        <td data-label="Acciones">
                                            <div className="superadmin-row-actions">
                                                <Link to={`/superadmin/audit/${tenant.id}`} className="action-link">Auditoria</Link>
                                                <Link to="/superadmin/subscriptions" className="action-link">Suscripcion</Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr className="empty-row"><td colSpan="6"><div className="empty-state"><h4>No hay tenants</h4></div></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
