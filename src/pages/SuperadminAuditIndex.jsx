import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { formatDate } from '../utils/helpers';
import { useSuperadminResource } from '../hooks/useSuperadminResource';

export default function SuperadminAuditIndex() {
    const [query, setQuery] = useState('');
    const fetchLogs = useCallback(async () => {
        const response = await apiRequest('/superadmin/audit-logs?limit=180');
        return Array.isArray(response?.logs) ? response.logs : [];
    }, []);

    const logsResource = useSuperadminResource('superadmin:audit:index', fetchLogs, []);
    const logs = logsResource.data;
    const loading = logsResource.loading;
    const refreshing = logsResource.refreshing;

    const filteredLogs = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return logs.filter((item) => {
            const haystack = `${item.action || ''} ${item.entityType || ''} ${item.entityId || ''} ${item.tenantId || ''}`.toLowerCase();
            return !normalizedQuery || haystack.includes(normalizedQuery);
        });
    }, [logs, query]);

    if (loading) {
        return <section className="view"><div className="empty-state"><span className="material-symbols-outlined">hourglass_top</span><h4>Cargando auditoria...</h4></div></section>;
    }

    return (
        <section className="view">
            <div className="card section-stack superadmin-toolbar">
                <div>
                    <h2>Auditoria global</h2>
                    <p className="muted">Bitacora de cambios de plataforma y tenants.</p>
                    {refreshing && <p className="muted small">Actualizando auditoria...</p>}
                </div>
                <input
                    className="superadmin-search"
                    placeholder="Buscar por accion, entidad o tenant"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>

            <div className="card section-stack">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Accion</th>
                                <th>Entidad</th>
                                <th>Tenant</th>
                                <th>Actor</th>
                                <th>Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                                <tr key={log.id}>
                                    <td data-label="Fecha">{formatDate(log.createdAt)}</td>
                                    <td data-label="Accion">{log.action || '-'}</td>
                                    <td data-label="Entidad">{log.entityType || '-'} · {log.entityId || '-'}</td>
                                    <td data-label="Tenant">{log.tenantId || '-'}</td>
                                    <td data-label="Actor">{log.actorRole || '-'}</td>
                                    <td data-label="Detalle">
                                        {log.tenantId ? <Link className="action-link" to={`/superadmin/audit/${log.tenantId}`}>Auditar tenant</Link> : <span className="muted">-</span>}
                                    </td>
                                </tr>
                            )) : (
                                <tr className="empty-row"><td colSpan="6"><div className="empty-state compact-empty-state"><h4>No hay logs</h4></div></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
