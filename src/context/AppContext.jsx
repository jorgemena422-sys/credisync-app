import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '../utils/api';
import { setCurrency } from '../utils/helpers';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);
export const DrawerContext = createContext(null);

export function defaultSettings() {
    return {
        personalLoanRate: 12,
        businessLoanRate: 15,
        mortgageLoanRate: 10,
        autoLoanRate: 14,
        latePenaltyRate: 5,
        graceDays: 3,
        autoApprovalScore: 720,
        maxDebtToIncome: 40,
        capitalBudget: 0,
        currency: 'DOP'
    };
}

export function defaultRiskModel() {
    return {
        initialScore: 70,
        onTimePaymentReward: 2.2,
        keptPromiseReward: 3.8,
        paymentActivityReward: 0.45,
        paymentActivityCap: 12,
        latePaymentPenalty: 3.4,
        brokenPromisePenalty: 11.5,
        pendingPromisePenalty: 2.4,
        overdueDayPenalty: 0.75,
        overdueDayCap: 20,
        overdueAccumulatedPenalty: 0.14,
        overdueAccumulatedCap: 14,
        lagInstallmentPenalty: 3.8,
        noPaymentHistoryPenalty: 6
    };
}

export function defaultSubscription() {
    return {
        id: '',
        tenantId: '',
        planId: '',
        planCode: 'credisync_monthly',
        planName: 'CrediSync Mensual',
        description: 'Suscripcion mensual con acceso completo a todas las funciones.',
        status: 'active',
        billingCycle: 'monthly',
        priceMonthly: 0,
        currency: 'DOP',
        currentPeriodStart: '',
        currentPeriodEnd: '',
        nextBillingDate: '',
        trialEndsAt: '',
        suspendedAt: null,
        cancelledAt: null,
        notes: '',
        features: {
            calendarIcsEnabled: true,
            advancedReportsEnabled: true,
            exportsEnabled: true,
            brandingEnabled: true,
            prioritySupport: true
        },
        limits: {
            maxUsers: 100000,
            maxCustomers: 1000000,
            maxActiveLoans: 1000000
        },
        usage: {
            users: 0,
            customers: 0,
            activeLoans: 0
        },
        isReadOnly: false
    };
}

function normalizeSubscriptionSnapshot(source, fallback) {
    const base = fallback || defaultSubscription();
    const incoming = source && typeof source === 'object' ? source : {};
    return {
        ...base,
        ...incoming,
        features: {
            ...defaultSubscription().features,
            ...(base.features || {}),
            ...((incoming && incoming.features) || {})
        },
        limits: {
            ...defaultSubscription().limits,
            ...(base.limits || {}),
            ...((incoming && incoming.limits) || {})
        },
        usage: {
            ...defaultSubscription().usage,
            ...(base.usage || {}),
            ...((incoming && incoming.usage) || {})
        },
        isReadOnly: String((incoming && incoming.status) || '').toLowerCase() === 'suspended'
    };
}

export const AppProvider = ({ children }) => {
    const { currentUser, isSuperadmin } = useAuth();
    const [state, setState] = useState({
        users: [],
        settings: defaultSettings(),
        riskModel: defaultRiskModel(),
        subscription: defaultSubscription(),
        customers: [],
        loans: [],
        payments: [],
        paymentPromises: [],
        collectionNotes: [],
        notifications: []
    });

    const [superadminUsers, setSuperadminUsers] = useState([]);
    const [isBootstrapping, setIsBootstrapping] = useState(false);
    const [hasBootstrapped, setHasBootstrapped] = useState(false);

    const refreshTenantSubscription = useCallback(async () => {
        if (!currentUser || isSuperadmin()) {
            return;
        }

        try {
            const response = await apiRequest('/subscription/current');
            if (!response || !response.subscription) {
                return;
            }

            setState((prev) => ({
                ...prev,
                subscription: normalizeSubscriptionSnapshot(response.subscription, prev.subscription || defaultSubscription())
            }));
        } catch {}
    }, [currentUser, isSuperadmin]);

    const refreshSuperadminUsers = useCallback(async () => {
        if (!isSuperadmin()) {
            setSuperadminUsers([]);
            return [];
        }

        const adminRes = await apiRequest('/superadmin/users');
        const users = Array.isArray(adminRes.users) ? adminRes.users : [];
        setSuperadminUsers(users);
        return users;
    }, [isSuperadmin]);

    const applyTenantSettings = useCallback((settingsPatch) => {
        setState((prev) => ({
            ...prev,
            settings: {
                ...defaultSettings(),
                ...(prev.settings || {}),
                ...((settingsPatch && typeof settingsPatch === 'object') ? settingsPatch : {})
            }
        }));
    }, []);

    const bootstrapState = useCallback(async (options = {}) => {
        const silent = Boolean(options && options.silent);

        if (!silent) {
            setIsBootstrapping(true);
        }

        try {
            const response = await apiRequest('/bootstrap');
            const fallbackState = {
                users: [],
                settings: defaultSettings(),
                riskModel: defaultRiskModel(),
                subscription: defaultSubscription(),
                customers: [],
                loans: [],
                payments: [],
                paymentPromises: [],
                collectionNotes: [],
                notifications: []
            };

            const incoming = response && response.state && typeof response.state === 'object' ? response.state : {};
            setState({
                ...fallbackState,
                ...incoming,
                settings: {
                    ...defaultSettings(),
                    ...(incoming.settings || {})
                },
                riskModel: {
                    ...defaultRiskModel(),
                    ...(incoming.riskModel || {})
                },
                subscription: normalizeSubscriptionSnapshot(incoming.subscription, defaultSubscription()),
                users: Array.isArray(incoming.users) ? incoming.users : [],
                customers: Array.isArray(incoming.customers) ? incoming.customers : [],
                loans: Array.isArray(incoming.loans) ? incoming.loans : [],
                payments: Array.isArray(incoming.payments) ? incoming.payments : [],
                paymentPromises: Array.isArray(incoming.paymentPromises) ? incoming.paymentPromises : [],
                collectionNotes: Array.isArray(incoming.collectionNotes) ? incoming.collectionNotes : [],
                notifications: Array.isArray(incoming.notifications) ? incoming.notifications : []
            });

            if (isSuperadmin()) {
                await refreshSuperadminUsers();
            } else {
                setSuperadminUsers([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setHasBootstrapped(true);
            if (!silent) {
                setIsBootstrapping(false);
            }
        }
    }, [isSuperadmin, refreshSuperadminUsers]);

    useEffect(() => {
        if (currentUser) {
            bootstrapState();
        }
    }, [currentUser, bootstrapState]);

    useEffect(() => {
        if (!currentUser) {
            setHasBootstrapped(false);
        }
    }, [currentUser]);

    useEffect(() => {
        setCurrency(state.settings?.currency || 'DOP');
    }, [state.settings?.currency]);

    useEffect(() => {
        if (!currentUser || isSuperadmin()) {
            return;
        }

        const runRefresh = () => {
            refreshTenantSubscription();
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                runRefresh();
            }
        };

        runRefresh();
        const intervalId = window.setInterval(runRefresh, 60 * 1000);
        window.addEventListener('focus', runRefresh);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', runRefresh);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [currentUser, isSuperadmin, refreshTenantSubscription]);

    const contextValue = useMemo(() => ({
        state,
        setState,
        applyTenantSettings,
        bootstrapState,
        superadminUsers,
        refreshSuperadminUsers,
        isBootstrapping,
        hasBootstrapped
    }), [state, applyTenantSettings, bootstrapState, superadminUsers, refreshSuperadminUsers, isBootstrapping, hasBootstrapped]);

    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
