import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export default function Layout({ children }) {
    const { currentUser, isSuperadmin, logout } = useAuth();
    const { state } = useApp();
    const location = useLocation();
    const navigate = useNavigate();

    const unreadNotifications = Array.isArray(state?.notifications)
        ? state.notifications.filter((item) => item.status === 'unread').length
        : 0;
    const subscription = state?.subscription || null;
    const subscriptionStatus = String(subscription?.status || '').toLowerCase();
    const isReadOnlySubscription = ['suspended', 'cancelled'].includes(subscriptionStatus);
    const hasSubscriptionAlert = ['past_due', 'suspended', 'cancelled'].includes(subscriptionStatus);

    const navItems = isSuperadmin()
        ? [
            { id: 'sa-summary', path: '/superadmin/summary', icon: 'space_dashboard', label: 'Resumen' },
            { id: 'sa-users', path: '/superadmin/users', icon: 'group', label: 'Usuarios' },
            { id: 'sa-tenants', path: '/superadmin/tenants', icon: 'apartment', label: 'Tenants' },
            { id: 'sa-subscriptions', path: '/superadmin/subscriptions', icon: 'subscriptions', label: 'Suscripciones' },
            { id: 'sa-plans', path: '/superadmin/plans', icon: 'sell', label: 'Planes' },
            { id: 'sa-audit', path: '/superadmin/audit', icon: 'manage_search', label: 'Auditoría' },
            { id: 'sa-settings', path: '/superadmin/settings', icon: 'settings', label: 'Config' },
        ]
        : [
            { id: 'dashboard', path: '/dashboard', icon: 'space_dashboard', label: 'Inicio' },
            { id: 'loans', path: '/loans', icon: 'account_balance_wallet', label: 'Préstamos' },
            { id: 'customers', path: '/customers', icon: 'group', label: 'Clientes' },
            { id: 'payments', path: '/payments', icon: 'point_of_sale', label: 'Pagos' },
            { id: 'reports', path: '/reports', icon: 'analytics', label: 'Reportes' },
            { id: 'settings', path: '/settings', icon: 'settings', label: 'Config' },
        ];

    const getViewTitle = () => {
        const map = {
            '/dashboard': 'Dashboard',
            '/loans': 'Préstamos',
            '/customers': 'Clientes',
            '/payments': 'Pagos',
            '/notifications': 'Alertas',
            '/reports': 'Reportes',
            '/settings': 'Configuración',
            '/superadmin/summary': 'Resumen de plataforma',
            '/superadmin/users': 'Usuarios',
            '/superadmin/tenants': 'Tenants',
            '/superadmin/subscriptions': 'Suscripciones',
            '/superadmin/plans': 'Planes',
            '/superadmin/audit': 'Auditoría',
            '/superadmin/settings': 'Configuración global',
        };
        if (location.pathname.startsWith('/superadmin/audit')) return 'Auditoría tenant';
        return map[location.pathname] || 'CrediSync';
    };

    return (
        <div className="app-layout">
            {/* ─── Topbar ─── */}
            <header className="topbar">
                <div className="topbar-brand">
                    <div className="logo-sm">CS</div>
                    <div>
                        <p className="eyebrow">CrediSync</p>
                        <h2>{getViewTitle()}</h2>
                    </div>
                </div>
                <div className="topbar-right">
                    {!isSuperadmin() && (
                        <button className="topbar-alert-btn" type="button" onClick={() => navigate('/notifications')}>
                            <span className="material-symbols-outlined">notifications</span>
                            {unreadNotifications > 0 && <span className="topbar-alert-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
                        </button>
                    )}
                    <div className="user-chip">
                        <div className="user-avatar">
                            <span className="material-symbols-outlined">person</span>
                        </div>
                        <div className="user-info">
                            <span>{currentUser?.name || "Admin"}</span>
                            <small>{currentUser?.role || "Administrador"}</small>
                            {!isSuperadmin() && <small className="user-plan-badge">Plan: {subscription?.planName || 'Starter'}</small>}
                        </div>
                    </div>
                </div>
            </header>

            {/* ─── Main Content ─── */}
            <main className="content">
                {!isSuperadmin() && hasSubscriptionAlert && (
                    <div className={`card section-stack ${isReadOnlySubscription ? 'subscription-banner-blocked' : 'subscription-banner-warning'}`}>
                        <div className="section-head split">
                            <div>
                                <h3>{isReadOnlySubscription ? 'Cuenta en modo solo lectura' : 'Plan pendiente de validación'}</h3>
                                <p className="muted">
                                    {isReadOnlySubscription
                                        ? 'Tu espacio está suspendido. Contacta al superadministrador para reactivar tu plan.'
                                        : 'Tu plan requiere revisión interna. Contacta al superadministrador para confirmar tu estado.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {children}
            </main>

            {/* ─── Bottom Dockbar ─── */}
            <nav className="dockbar" aria-label="Navegación principal">
                <div className="dockbar-nav">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            className={`dock-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                            onClick={() => navigate(item.path)}
                            title={item.label}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span className="dock-label">{item.label}</span>
                        </button>
                    ))}
                </div>
                <button className="dock-item dock-logout" onClick={logout} title="Cerrar sesión">
                    <span className="material-symbols-outlined">logout</span>
                    <span className="dock-label">Salir</span>
                </button>
            </nav>
        </div>
    );
}
