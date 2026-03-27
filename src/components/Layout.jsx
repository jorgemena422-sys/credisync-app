import React, { useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

function pageTitle(pathname, isSuperAdmin) {
    const path = String(pathname || '').toLowerCase();

    if (isSuperAdmin) {
        if (path.startsWith('/superadmin/summary')) return 'Centro';
        if (path.startsWith('/superadmin/users')) return 'Usuarios';
        if (path.startsWith('/superadmin/tenants')) return 'Tenants';
        if (path.startsWith('/superadmin/subscriptions')) return 'Suscripciones';
        if (path.startsWith('/notifications')) return 'Notificaciones';
        if (path.startsWith('/superadmin/plans')) return 'Planes';
        if (path.startsWith('/superadmin/audit')) return 'Auditoria';
        if (path.startsWith('/superadmin/settings')) return 'Configuracion';
        return 'Superadmin';
    }

    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/loans')) return 'Prestamos';
    if (path.startsWith('/customers')) return 'Clientes';
    if (path.startsWith('/payments')) return 'Cobros';
    if (path.startsWith('/notifications')) return 'Notificaciones';
    if (path.startsWith('/reports')) return 'Reportes';
    if (path.startsWith('/settings')) return 'Configuracion';
    return 'CrediSync';
}

export default function Layout({ children, hideNavigation = false }) {
    const { currentUser, isSuperadmin, logout } = useAuth();
    const { state } = useApp();
    const location = useLocation();
    const navigate = useNavigate();
    const isSuperAdmin = isSuperadmin();

    const displayName = useMemo(() => {
        return currentUser?.name || currentUser?.full_name || currentUser?.email || 'Usuario';
    }, [currentUser]);

    const userRoleLabel = isSuperAdmin ? 'Superadmin' : 'Administrador';

    const tenantNavItems = [
        { path: '/dashboard', label: 'Inicio', icon: 'dashboard' },
        { path: '/loans', label: 'Prestamos', icon: 'payments' },
        { path: '/customers', label: 'Clientes', icon: 'groups' },
        { path: '/payments', label: 'Cobros', icon: 'point_of_sale' },
        { path: '/settings', label: 'Ajustes', icon: 'settings' }
    ];

    const superadminNavItems = [
        { path: '/superadmin/summary', label: 'Centro', icon: 'space_dashboard' },
        { path: '/superadmin/subscriptions', label: 'Cobros', icon: 'payments' },
        { path: '/superadmin/tenants', label: 'Tenants', icon: 'apartment' },
        { path: '/superadmin/settings', label: 'Ajustes', icon: 'tune' }
    ];

    const navItems = hideNavigation ? [] : (isSuperAdmin ? superadminNavItems : tenantNavItems);

    const unreadCount = useMemo(() => {
        return (state.notifications || []).filter((item) => {
            const status = String(item?.status || '').toLowerCase();
            return status !== 'read' && item?.is_read !== true;
        }).length;
    }, [state.notifications]);

    const normalizedPlanName = String(currentUser?.planName || state?.subscription?.planName || '').trim();

    return (
        <div className="app-layout">
            <header className="topbar">
                <div className="topbar-brand">
                    <div className="logo-sm">CS</div>
                    <div>
                        <p className="eyebrow">CrediSync</p>
                        <h2>{pageTitle(location.pathname, isSuperAdmin)}</h2>
                    </div>
                </div>

                <div className="topbar-right">
                    <button
                        type="button"
                        className="topbar-alert-btn"
                        onClick={() => navigate('/notifications')}
                        aria-label="Ver notificaciones"
                        title="Notificaciones"
                    >
                        <span className="material-symbols-outlined">notifications</span>
                        {unreadCount > 0 && (
                            <span className="topbar-alert-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                        )}
                    </button>

                    <div className="user-chip">
                        <div className="user-avatar">
                            <span className="material-symbols-outlined">person</span>
                        </div>
                        <div className="user-info">
                            <span>{displayName}</span>
                            <small>{userRoleLabel}</small>
                            {!isSuperAdmin && normalizedPlanName ? (
                                <span className="user-plan-badge">{normalizedPlanName}</span>
                            ) : null}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="topbar-alert-btn"
                        onClick={logout}
                        aria-label="Cerrar sesion"
                        title="Cerrar sesion"
                    >
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </div>
            </header>

            <main className="content">{children}</main>

            {!hideNavigation && (
                <nav className="dockbar" aria-label="Navegacion principal">
                    <div className="dockbar-nav">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
                            >
                                <span className="material-symbols-outlined">{item.icon}</span>
                                <span className="dock-label">{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </nav>
            )}
        </div>
    );
}
