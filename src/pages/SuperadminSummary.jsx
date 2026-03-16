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
            users: 0,
            lastAccess: null
        };

        current.users += 1;
        const candidate = user.lastSignInAt || user.lastLoginAt || user.createdAt || null;
        if (!current.lastAccess || new Date(candidate || 0).getTime() > new Date(current.lastAccess || 0).getTime()) {
            current.lastAccess = candidate;
        }

        map.set(user.tenantId, current);
    });

    return [...map.values()];
}

function SummaryCard({ label, value, helper }) {
    return (
        <article className="kpi motion-item">
            <div className="kpi-top">
                <span className="material-symbols-outlined">monitoring</span>
                <p>{label}</p>
            </div>
            <h4>{value}</h4>
            <p className="muted small">{helper}</p>
        </article>
    );
}

export default function SuperadminSummary() {
    const { superadminUsers } = useApp();

    const data = useMemo(() => {
        const users = superadminUsers || [];
        const tenants = aggregateTenants(users);
        return {
            users: users.length,
            activeUsers: users.filter((user) => user.status === 'active').length,
            inactiveUsers: users.filter((user) => user.status !== 'active').length,
            superadmins: users.filter((user) => String(user.role || '').toLowerCase().includes('super')).length,
            tenants,
            activeTenants: tenants.filter((tenant) => tenant.status === 'active').length,
            pendingSetup: users.filter((user) => !user.tenantId).length,
            recentUsers: [...users]
                .sort((a, b) => new Date(b.lastSignInAt || b.createdAt || 0) - new Date(a.lastSignInAt || a.createdAt || 0))
                .slice(0, 6),
            tenantsToWatch: [...tenants]
                .sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || a.users - b.users)
                .slice(0, 5)
        };
    }, [superadminUsers]);

    return (
        <section className="view">
            <div className="card section-stack superadmin-head">
                <div className="section-head split">
                    <div>
                        <h3>Resumen de plataforma</h3>
                        <p className="muted">Vista ejecutiva del estado de usuarios, tenants y focos de soporte.</p>
                    </div>
                    <Link to="/superadmin/users" className="btn btn-primary">Gestionar usuarios</Link>
                </div>
            </div>

            <div className="kpi-grid">
                <SummaryCard label="Usuarios" value={data.users} helper="Total de cuentas registradas" />
                <SummaryCard label="Superadmins" value={data.superadmins} helper="Acceso total a plataforma" />
                <SummaryCard label="Tenants activos" value={data.activeTenants} helper="Workspaces operativos" />
                <SummaryCard label="Usuarios inactivos" value={data.inactiveUsers} helper="Casos que requieren seguimiento" />
                <SummaryCard label="Pendientes de setup" value={data.pendingSetup} helper="Sin tenant asignado" />
            </div>

            <div className="superadmin-layout">
                <div className="card section-stack superadmin-main-panel">
                    <div className="section-head split">
                        <div>
                            <h3>Actividad reciente</h3>
                            <p className="muted">Ultimos accesos y cuentas que conviene revisar.</p>
                        </div>
                        <Link to="/superadmin/audit" className="action-link">Ir a auditoria</Link>
                    </div>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Rol</th>
                                    <th>Tenant</th>
                                    <th>Ultimo acceso</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recentUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td data-label="Usuario">
                                            <div className="cell-stack">
                                                <strong>{user.name || user.email}</strong>
                                                <span className="muted small">{user.email}</span>
                                            </div>
                                        </td>
                                        <td data-label="Rol">{user.role}</td>
                                        <td data-label="Tenant">{user.tenantName || 'Sin tenant'}</td>
                                        <td data-label="Ultimo acceso">{formatDate(user.lastSignInAt || user.lastLoginAt || user.createdAt)}</td>
                                        <td data-label="Estado"><span className={`status status-${user.status}`}>{user.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <aside className="card section-stack superadmin-side-panel">
                    <div className="section-head">
                        <h3>Tenants a vigilar</h3>
                    </div>
                    <div className="superadmin-list">
                        {data.tenantsToWatch.map((tenant) => (
                            <div key={tenant.id} className="superadmin-list-item stack-item">
                                <div>
                                    <span className="muted small">{tenant.id}</span>
                                    <strong>{tenant.name}</strong>
                                    <span className="muted small">{tenant.users} usuario(s)</span>
                                </div>
                                <Link to={`/superadmin/audit/${tenant.id}`} className="action-link">Auditar</Link>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
        </section>
    );
}
