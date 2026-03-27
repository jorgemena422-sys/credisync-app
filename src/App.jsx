import React, { Suspense, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { DrawerProvider } from './context/DrawerContext';
import { isStagingRuntimeTarget } from './utils/runtimeTarget';
import { lazyWithPreload, preloadComponents } from './utils/lazyWithPreload';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ResetPasswordCode from './pages/ResetPasswordCode';
import Layout from './components/Layout';
import AppUpdateBanner from './components/AppUpdateBanner';

const DashboardPage = lazyWithPreload(() => import('./pages/Dashboard'));
const LoansPage = lazyWithPreload(() => import('./pages/Loans'));
const CustomersPage = lazyWithPreload(() => import('./pages/Customers'));
const PaymentsPage = lazyWithPreload(() => import('./pages/Payments'));
const NotificationsPage = lazyWithPreload(() => import('./pages/Notifications'));
const ReportsPage = lazyWithPreload(() => import('./pages/Reports'));
const SettingsPage = lazyWithPreload(() => import('./pages/Settings'));
const SubscriptionBlockedPage = lazyWithPreload(() => import('./pages/SubscriptionBlocked'));

const SuperadminUsersPage = lazyWithPreload(() => import('./pages/Superadmin'));
const SuperadminSummaryPage = lazyWithPreload(() => import('./pages/SuperadminSummary'));
const SuperadminTenantsPage = lazyWithPreload(() => import('./pages/SuperadminTenants'));
const SuperadminSubscriptionsPage = lazyWithPreload(() => import('./pages/SuperadminSubscriptions'));
const SuperadminAuditIndexPage = lazyWithPreload(() => import('./pages/SuperadminAuditIndex'));
const SuperadminSettingsPage = lazyWithPreload(() => import('./pages/SuperadminSettings'));
const SuperadminAuditPage = lazyWithPreload(() => import('./pages/SuperadminAudit'));

const ADMIN_ROUTE_COMPONENTS = [
    DashboardPage,
    LoansPage,
    CustomersPage,
    PaymentsPage,
    NotificationsPage,
    ReportsPage,
    SettingsPage
];

const SUPERADMIN_ROUTE_COMPONENTS = [
    SuperadminSummaryPage,
    SuperadminUsersPage,
    SuperadminTenantsPage,
    SuperadminSubscriptionsPage,
    NotificationsPage,
    SuperadminAuditIndexPage,
    SuperadminSettingsPage,
    SuperadminAuditPage
];

function BootSplash({ title, copy }) {
    return (
        <section className="boot-splash" aria-live="polite" aria-busy="true">
            <div className="boot-splash-orb boot-splash-orb-left" />
            <div className="boot-splash-orb boot-splash-orb-right" />
            <div className="boot-splash-card">
                <div className="boot-splash-brand">
                    <span className="boot-splash-badge">CrediSync</span>
                    <div className="boot-splash-icon" aria-hidden="true">
                        <span className="material-symbols-outlined">bolt</span>
                    </div>
                </div>
                <div className="boot-splash-loader" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
                <div className="boot-splash-copy">
                    <h1>{title}</h1>
                    <p>{copy}</p>
                </div>
                <div className="boot-splash-progress" aria-hidden="true">
                    <span className="boot-splash-progress-bar" />
                </div>
                <div className="boot-splash-meta">
                    <span>Autenticando acceso</span>
                    <span>Preparando panel inicial</span>
                </div>
            </div>
        </section>
    );
}

function RoutePanelLoading() {
    return (
        <section className="view">
            <div className="card section-stack empty-state" style={{ minHeight: '24vh' }}>
                <span className="material-symbols-outlined">autorenew</span>
                <h4>Cargando vista</h4>
                <p>Estamos preparando la seccion solicitada.</p>
            </div>
        </section>
    );
}

function RoutedViews({ isSuperadmin }) {
    const { hasBootstrapped, isBootstrapping, state } = useApp();
    const warmedRoleRef = useRef('');
    const isTenantAccessBlocked = !isSuperadmin && String(state?.subscription?.status || '').toLowerCase() === 'suspended';

    const hasRenderableState =
        (state?.customers?.length || 0) > 0
        || (state?.loans?.length || 0) > 0
        || (state?.payments?.length || 0) > 0
        || (state?.notifications?.length || 0) > 0
        || Boolean(state?.subscription?.planName)
        || (state?.users?.length || 0) > 0;

    useEffect(() => {
        if (!isStagingRuntimeTarget) {
            return undefined;
        }

        const roleKey = isSuperadmin ? 'superadmin' : 'admin';
        if (warmedRoleRef.current === roleKey) {
            return undefined;
        }
        warmedRoleRef.current = roleKey;

        const targets = isSuperadmin ? SUPERADMIN_ROUTE_COMPONENTS : ADMIN_ROUTE_COMPONENTS;
        let idleId = null;
        let timeoutId = null;

        const warm = () => {
            preloadComponents(targets);
        };

        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
            idleId = window.requestIdleCallback(warm, { timeout: 1200 });
        } else {
            timeoutId = window.setTimeout(warm, 180);
        }

        return () => {
            if (idleId && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
                window.cancelIdleCallback(idleId);
            }
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [isSuperadmin]);

    if (isStagingRuntimeTarget && !hasBootstrapped && isBootstrapping && !hasRenderableState) {
        return (
            <BootSplash
                title="Sincronizando panel"
                copy="Estamos preparando tus datos operativos para una carga mas fluida."
            />
        );
    }

    if (isTenantAccessBlocked) {
        return (
            <Layout hideNavigation>
                <Suspense fallback={<RoutePanelLoading />}>
                    <SubscriptionBlockedPage />
                </Suspense>
            </Layout>
        );
    }

    return (
        <Layout>
            <Suspense fallback={<RoutePanelLoading />}>
                <Routes>
                    {isSuperadmin && (
                        <>
                            <Route path="/" element={<Navigate to="/superadmin/summary" replace />} />
                            <Route path="/superadmin" element={<Navigate to="/superadmin/summary" replace />} />
                            <Route path="/superadmin/summary" element={<SuperadminSummaryPage />} />
                            <Route path="/superadmin/users" element={<SuperadminUsersPage />} />
                            <Route path="/superadmin/tenants" element={<SuperadminTenantsPage />} />
                            <Route path="/superadmin/subscriptions" element={<SuperadminSubscriptionsPage />} />
                            <Route path="/notifications" element={<NotificationsPage />} />
                            <Route path="/superadmin/plans" element={<Navigate to="/superadmin/settings" replace />} />
                            <Route path="/superadmin/audit" element={<SuperadminAuditIndexPage />} />
                            <Route path="/superadmin/audit/:tenantId" element={<SuperadminAuditPage />} />
                            <Route path="/superadmin/settings" element={<SuperadminSettingsPage />} />
                            <Route path="*" element={<Navigate to="/superadmin/summary" replace />} />
                        </>
                    )}
                    {!isSuperadmin && (
                        <>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/loans" element={<LoansPage />} />
                            <Route path="/customers" element={<CustomersPage />} />
                            <Route path="/payments" element={<PaymentsPage />} />
                            <Route path="/notifications" element={<NotificationsPage />} />
                            <Route path="/reports" element={<ReportsPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </>
                    )}
                </Routes>
            </Suspense>
        </Layout>
    );
}

const AppRoutes = () => {
    const { currentUser, isSuperadmin, loading } = useAuth();

    if (loading) {
        return (
            <BootSplash
                title="Conectando tu sesion"
                copy="Verificando credenciales para abrir CrediSync."
            />
        );
    }

    if (currentUser === null) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reset-password-code" element={<ResetPasswordCode />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    return (
        <AppProvider>
            <DrawerProvider>
                <RoutedViews isSuperadmin={isSuperadmin()} />
            </DrawerProvider>
        </AppProvider>
    );
};

export default function App() {
    return (
        <ToastProvider>
            <AppUpdateBanner />
            <AppRoutes />
        </ToastProvider>
    );
}
