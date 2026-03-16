import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

function uniqueTenants(users) {
    const map = new Map();
    users.forEach((user) => {
        if (!user.tenantId || map.has(user.tenantId)) return;
        map.set(user.tenantId, {
            id: user.tenantId,
            name: user.tenantName || 'Tenant sin nombre',
            status: user.tenantStatus || 'inactive'
        });
    });
    return [...map.values()];
}

export default function SuperadminAuditIndex() {
    const { superadminUsers } = useApp();

    const { tenants, users } = useMemo(() => ({
        tenants: uniqueTenants(superadminUsers || []),
        users: (superadminUsers || []).filter((user) => user.tenantId)
    }), [superadminUsers]);

    return (
        <section className="view">
            <div className="card section-stack superadmin-head">
                <div className="section-head split">
                    <div>
                        <h3>Auditoria</h3>
                        <p className="muted">Punto de entrada para inspeccionar tenants y sus administradores.</p>
                    </div>
                </div>
            </div>

            <div className="superadmin-layout">
                <div className="card section-stack superadmin-main-panel">
                    <div className="section-head">
                        <h3>Auditar por tenant</h3>
                    </div>
                    <div className="superadmin-list">
                        {tenants.map((tenant) => (
                            <div key={tenant.id} className="superadmin-list-item stack-item">
                                <div>
                                    <span className="muted small"><code>{tenant.id}</code></span>
                                    <strong>{tenant.name}</strong>
                                </div>
                                <Link to={`/superadmin/audit/${tenant.id}`} className="action-link">Auditar</Link>
                            </div>
                        ))}
                    </div>
                </div>

                <aside className="card section-stack superadmin-side-panel">
                    <div className="section-head">
                        <h3>Administradores auditables</h3>
                    </div>
                    <div className="superadmin-list">
                        {users.slice(0, 8).map((user) => (
                            <div key={user.id} className="superadmin-list-item stack-item">
                                <div>
                                    <span className="muted small">{user.tenantName}</span>
                                    <strong>{user.name || user.email}</strong>
                                </div>
                                <Link to={`/superadmin/audit/${user.tenantId}`} className="action-link">Ver</Link>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
        </section>
    );
}
