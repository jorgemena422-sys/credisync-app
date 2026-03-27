import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/helpers';
import { isStagingRuntimeTarget } from '../utils/runtimeTarget';

function notificationIcon(type) {
    switch (String(type || '').toLowerCase()) {
        case 'payment_received':
            return 'payments';
        case 'due_today':
            return 'event_upcoming';
        case 'overdue_alert':
            return 'warning';
        case 'promise_broken':
            return 'error';
        case 'new_loan':
            return 'add_card';
        case 'plan_expiring':
            return 'event_busy';
        case 'tenant_signup_alert':
            return 'person_add';
        default:
            return 'notifications';
    }
}

function notificationTone(severity) {
    switch (String(severity || '').toLowerCase()) {
        case 'critical':
            return 'status-overdue';
        case 'warning':
            return 'status-pending';
        default:
            return 'status-active';
    }
}

function isUnreadNotification(item) {
    const status = String(item?.status || '').toLowerCase();
    return status !== 'read' && item?.is_read !== true;
}

export default function Notifications() {
    const { state, setState, bootstrapState } = useApp();
    const { isSuperadmin } = useAuth();
    const { showToast } = useToast();
    const notifications = state.notifications || [];
    const isSuperAdmin = isSuperadmin();

    const unreadCount = useMemo(() => notifications.filter(isUnreadNotification).length, [notifications]);

    const markAsRead = async (notificationId) => {
        try {
            await apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' });

            setState((prev) => ({
                ...prev,
                notifications: (prev.notifications || []).map((item) => (
                    item.id === notificationId
                        ? { ...item, status: 'read', is_read: true, readAt: new Date().toISOString() }
                        : item
                ))
            }));

            if (isStagingRuntimeTarget) {
                bootstrapState({ silent: true }).catch(() => undefined);
            } else {
                await bootstrapState();
            }
        } catch (error) {
            showToast(error.message || 'No se pudo marcar la notificacion como leida');
        }
    };

    const markAllAsRead = async () => {
        try {
            await apiRequest('/notifications/read-all', { method: 'POST' });

            setState((prev) => ({
                ...prev,
                notifications: (prev.notifications || []).map((item) => ({
                    ...item,
                    status: 'read',
                    is_read: true,
                    readAt: item.readAt || new Date().toISOString()
                }))
            }));

            if (isStagingRuntimeTarget) {
                bootstrapState({ silent: true }).catch(() => undefined);
            } else {
                await bootstrapState();
            }
        } catch (error) {
            showToast(error.message || 'No se pudieron actualizar las notificaciones');
        }
    };

    return (
        <section id="view-notifications" className="view">
            <div className="card section-stack">
                <div className="section-head split">
                    <div>
                        <h3>Notificaciones</h3>
                        <p className="muted">
                            {isSuperAdmin
                                ? 'Centraliza altas de clientes y avisos operativos del entorno superadmin.'
                                : 'Centraliza alertas de cobranza, cartera y suscripcion.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={markAllAsRead}
                        disabled={unreadCount === 0}
                    >
                        Marcar todas como leidas
                    </button>
                </div>
            </div>

            <div className="card section-stack">
                {notifications.length > 0 ? (
                    <div className="superadmin-list">
                        {notifications.map((notification) => {
                            const unread = isUnreadNotification(notification);
                            return (
                                <article
                                    key={notification.id}
                                    className="superadmin-list-item stack-item"
                                    style={{ cursor: unread ? 'pointer' : 'default' }}
                                    onClick={() => {
                                        if (unread) {
                                            markAsRead(notification.id);
                                        }
                                    }}
                                >
                                    <div>
                                        <div className="section-head split" style={{ marginBottom: '0.35rem' }}>
                                            <strong>{notification.title || 'Notificacion'}</strong>
                                            <span className={`status ${notificationTone(notification.severity)}`}>
                                                {unread ? 'No leida' : 'Leida'}
                                            </span>
                                        </div>
                                        <p className="muted" style={{ margin: 0 }}>{notification.message || '-'}</p>
                                        <div className="superadmin-inline-meta" style={{ marginTop: '0.55rem' }}>
                                            <span className="muted small">{formatDate(notification.createdAt || notification.created_at)}</span>
                                            <span className="muted small">{String(notification.type || 'notificacion').toLowerCase()}</span>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined">{notificationIcon(notification.type)}</span>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state">
                        <span className="material-symbols-outlined">notifications_none</span>
                        <h4>No tienes notificaciones pendientes</h4>
                        <p>{isSuperAdmin ? 'Cuando entre un nuevo cliente o haya eventos administrativos, apareceran aqui.' : 'Cuando haya actividad relevante en tu cartera, aparecera aqui.'}</p>
                    </div>
                )}
            </div>
        </section>
    );
}
