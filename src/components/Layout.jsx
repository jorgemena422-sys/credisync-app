import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDrawer } from '../context/DrawerContext';

export const Badge = ({ type = 'info', text }) => (
  <span className={`badge badge-${type}`}>{text}</span>
);

const Layout = ({ children }) => {
  const { user, isSuperAdmin, logout } = useAuth();
  const { openLoanDrawer, openPaymentDrawer } = useDrawer();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/loans')) return 'Préstamos';
    if (path.startsWith('/customers')) return 'Clientes';
    if (path.startsWith('/payments')) return 'Pagos y Cobros';
    if (path.startsWith('/notifications')) return 'Notificaciones';
    if (path.startsWith('/settings')) return 'Configuración';
    return 'CrediSync';
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'dashboard' },
    { path: '/loans', label: 'Préstamos', icon: 'payments' },
    { path: '/customers', label: 'Clientes', icon: 'people' },
    { path: '/payments', label: 'Cobros', icon: 'account_balance_wallet' },
    { path: '/notifications', label: 'Alertas', icon: 'notifications' }
  ];

  return (
    <div className="app-container">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <button className="menu-btn mobile-only" onClick={() => setSidebarOpen(true)}>
            <span className="material-icons">menu</span>
          </button>
          <h1>{getPageTitle()}</h1>
        </div>
        <div className="topbar-right">
          {user?.subscription_days_left <= 3 && (
            <Badge type="warning" text={`Plan expira en ${user.subscription_days_left} días`} />
          )}
          <div className="user-profile">
            <span className="user-name">{user?.full_name}</span>
            {isSuperAdmin && <Badge type="primary" text="Admin" />}
          </div>
          <button className="logout-btn" onClick={logout}>
            <span className="material-icons text-ruby">logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="material-icons">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Quick Action Button */}
      <div className="fab-container">
        <button className="fab" onClick={openLoanDrawer}>
          <span className="material-icons">add</span>
        </button>
      </div>
    </div>
  );
};

export default Layout;