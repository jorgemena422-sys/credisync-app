import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/helpers';

const SEVERITY_LABEL = {
    info: 'Info',
    success: 'Exito',
    warning: 'Alerta',
    critical: 'Critica'
};

export default function Notifications() {
    const { state, bootstrapState } = useApp();
    const { showToast } = useToast();
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(false);

    const notifications = Array.isArray(state.notifications) ? state.notifications : [];

    const summary = useMemo(() => {
        const unread = notifications.filter((item) => item.status === 'unread').length;
        const criticalUnread = notifications.filter((item) => item.status === 'unread' && item.severity === 'critical').length;
        const today = new Date().toISOString().slice(0, 10);
        const todayCount = notifications.filter((item) => String(item.eventDate || '').slice(0, 10) === today).length;
        return { unread, criticalUnread, todayCount };
    }, [notifications]);

    const visible = useMemo(() => {
        return notifications.filter((item) => {
            if (filter === 'unread') return item.status === 'unread';
            if (filter === 'critical') return item.severity === 'critical';
            if (filter === 'today') {
                const today = new Date().toISOString().slice(0, 10);
                return String(item.eventDate || '').slice(0, 10) === today;
            }
            return true;
        });
    }, [notifications, filter]);

    const markAsRead = async (id) => {
        try {
            await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
            await bootstrapState();
        } catch (error) {
            showToast(error.message || 'No se pudo marcar la alerta');
        }
    };

    const markAllAsRead = async () => {
        try {
            setLoading(true);
            await apiRequest('/notifications/read-all', { method: 'POST' });
            await bootstrapState();
            showToast('Notificaciones marcadas como leidas');
        } catch (error) {
            showToast(error.message || 'No fue posible completar la accion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="view">
            <div className="card section-stack">
                <div className="section-head split">
                    <div>
                        <h3>Centro de notificaciones</h3>
                        <p className="muted">Alertas automatizadas de cobranza, mora, promesas y capacidad de capital.</p>
                    </div>
                    <button className="btn btn-ghost" type="button" disabled={loading || summary.unread === 0} onClick={markAllAsRead}>
                        {loading ? 'Procesando...' : 'Marcar todo como leido'}
                    </button>
                </div>

                <div className="payments-risk-strip">
                    <div className="payments-risk-card">
                        <span className="muted small">No leidas</span>
                        <strong>{summary.unread}</strong>
                    </div>
                    <div className="payments-risk-card">
                        <span className="muted small">Criticas no leidas</span>
                        <strong>{summary.criticalUnread}</strong>
                    </div>
                    <div className="payments-risk-card">
                        <span className="muted small">Eventos hoy</span>
                        <strong>{summary.todayCount}</strong>
                    </div>
                </div>

                <div className="payments-queue-toolbar">
                    <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                        <option value="all">Todas</option>
                        <option value="unread">No leidas</option>
                        <option value="critical">Criticas</option>
                        <option value="today">Solo hoy</option>
                    </select>
                </div>
            </div>

            <div className="card section-stack">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Tipo</th>
                                <th>Detalle</th>
                                <th>Severidad</th>
                                <th>Estado</th>
                                <th>Accion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.length > 0 ? (
                                visible.map((item) => (
                                    <tr key={item.id} className="motion-item">
                                        <td data-label="Fecha">{formatDate(item.createdAt || item.eventDate)}</td>
                                        <td data-label="Tipo">{item.title}</td>
                                        <td data-label="Detalle">{item.message}</td>
                                        <td data-label="Severidad">
                                            <span className={`status queue-risk queue-risk-${item.severity === 'critical' ? 'critical' : item.severity === 'warning' ? 'high' : 'normal'}`}>
                                                {SEVERITY_LABEL[item.severity] || item.severity}
                                            </span>
                                        </td>
                                        <td data-label="Estado">
                                            <span className={`status ${item.status === 'read' ? 'status-paid' : 'status-pending'}`}>
                                                {item.status === 'read' ? 'Leida' : 'Pendiente'}
                                            </span>
                                        </td>
                                        <td data-label="Accion">
                                            {item.status === 'unread' ? (
                                                <button type="button" className="action-link" onClick={() => markAsRead(item.id)}>
                                                    Marcar leida
                                                </button>
                                            ) : (
                                                <span className="muted small">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr className="empty-row">
                                    <td colSpan="6">
                                        <div className="empty-state compact-empty-state">
                                            <span className="material-symbols-outlined">notifications_off</span>
                                            <h4>Sin notificaciones para este filtro</h4>
                                            <p>Cuando existan eventos de cobranza o mora apareceran aqui.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
