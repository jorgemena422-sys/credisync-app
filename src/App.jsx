import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { DrawerProvider } from './context/DrawerContext';

// Temporary Page Placeholders until populated
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import ResetPasswordCode from './pages/ResetPasswordCode';
import ResetPasswordNew from './pages/ResetPasswordNew';
import Dashboard from './pages/Dashboard';
import Loans from './pages/Loans';
import Customers from './pages/Customers';
import Payments from './pages/Payments';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import SuperadminUsers from './pages/Superadmin';
import SuperadminSummary from './pages/SuperadminSummary';
import SuperadminTenants from './pages/SuperadminTenants';
import SuperadminPlans from './pages/SuperadminPlans';
import SuperadminSubscriptions from './pages/SuperadminSubscriptions';
import SuperadminAuditIndex from './pages/SuperadminAuditIndex';
import SuperadminSettings from './pages/SuperadminSettings';
import SuperadminAudit from './pages/SuperadminAudit';
import Layout from './components/Layout';
import AppUpdateBanner from './components/AppUpdateBanner';

const AppRoutes = () => {
    const { currentUser, isSuperadmin } = useAuth();

    // Allow public access to password reset pages
    if (currentUser === null) {
        return (
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reset-password-code" element={<ResetPasswordCode />} />
                <Route path="/reset-password-new" element={<ResetPasswordNew />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    return (
        <AppProvider>
            <DrawerProvider>
                <Layout>
                    <Routes>
                        {isSuperadmin() && (
                            <>
                                <Route path="/" element={<Navigate to="/superadmin/summary" replace />} />
                                <Route path="/superadmin" element={<Navigate to="/superadmin/summary" replace />} />
                                <Route path="/superadmin/summary" element={<SuperadminSummary />} />
                                <Route path="/superadmin/users" element={<SuperadminUsers />} />
                                <Route path="/superadmin/tenants" element={<SuperadminTenants />} />
                                <Route path="/superadmin/subscriptions" element={<SuperadminSubscriptions />} />
                                <Route path="/superadmin/plans" element={<SuperadminPlans />} />
                                <Route path="/superadmin/audit" element={<SuperadminAuditIndex />} />
                                <Route path="/superadmin/audit/:tenantId" element={<SuperadminAudit />} />
                                <Route path="/superadmin/settings" element={<SuperadminSettings />} />
                                <Route path="*" element={<Navigate to="/superadmin/summary" replace />} />
                            </>
                        )}
                        {!isSuperadmin() && (
                            <>
                                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/loans" element={<Loans />} />
                                <Route path="/customers" element={<Customers />} />
                                <Route path="/payments" element={<Payments />} />
                                <Route path="/notifications" element={<Notifications />} />
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </>
                        )}
                    </Routes>
                </Layout>
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
