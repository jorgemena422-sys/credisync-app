import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { invalidateSuperadminResource, setSuperadminResource, useSuperadminResource } from '../hooks/useSuperadminResource';
import { moneyWithCurrency } from '../utils/helpers';
import {
    currentBrowserTimezone,
    fetchPushStatus,
    isPushSupportedInBrowser,
    sendPushTest,
    subscribeToPush,
    unsubscribeFromPush
} from '../utils/push';

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function isIosDevice() {
    if (typeof navigator === 'undefined') {
        return false;
    }
    const ua = String(navigator.userAgent || '').toLowerCase();
    return ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod');
}

function isStandaloneMode() {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        return Boolean(
            window.matchMedia?.('(display-mode: standalone)')?.matches
            || window.navigator?.standalone
        );
    } catch {
        return false;
    }
}

function selectUnifiedBillingPlan(plans) {
    const entries = Array.isArray(plans) ? plans : [];
    return entries.find((plan) => String(plan?.id || '') === 'PLAN-CREDISYNC-MONTHLY')
        || entries.find((plan) => String(plan?.code || '').trim().toLowerCase() === 'credisync_monthly')
        || entries[0]
        || null;
}

export default function SuperadminSettings() {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [billingSaving, setBillingSaving] = useState(false);
    const [billingDirty, setBillingDirty] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [pushSaving, setPushSaving] = useState(false);
    const [pushTesting, setPushTesting] = useState(false);
    const [pushStatusLoadError, setPushStatusLoadError] = useState('');
    const [form, setForm] = useState({
        platformName: 'CrediSync',
        supportEmail: '',
        supportPhone: '',
        allowAdminRegistration: true,
        newTenantStatus: 'active',
        tenantDefaults: {
            personalLoanRate: 12,
            businessLoanRate: 15,
            mortgageLoanRate: 10,
            autoLoanRate: 14,
            latePenaltyRate: 5,
            graceDays: 3,
            autoApprovalScore: 720,
            maxDebtToIncome: 40,
            capitalBudget: 0
        },
        riskModel: {
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
        }
    });
    const [billingForm, setBillingForm] = useState({
        id: '',
        name: 'CrediSync Mensual',
        description: 'Suscripcion mensual con acceso completo a todas las funciones del sistema.',
        priceMonthly: 0,
        currency: 'DOP'
    });
    const [pushStatus, setPushStatus] = useState({
        configured: false,
        supportedByDevice: false,
        enabled: false,
        subscriptionCount: 0,
        timezone: 'America/Santo_Domingo',
        vapidPublicKey: ''
    });

    const fetchSettings = useCallback(async () => {
        const response = await apiRequest('/superadmin/settings');
        return response?.settings || null;
    }, []);

    const fetchBillingPlan = useCallback(async () => {
        const response = await apiRequest('/superadmin/plans');
        const plans = Array.isArray(response?.plans) ? response.plans : [];
        return selectUnifiedBillingPlan(plans);
    }, []);

    const settingsResource = useSuperadminResource('superadmin:settings', fetchSettings, null);
    const billingPlanResource = useSuperadminResource('superadmin:billing-plan', fetchBillingPlan, null);
    const loading = settingsResource.loading;
    const refreshing = settingsResource.refreshing || billingPlanResource.refreshing;

    useEffect(() => {
        if (settingsResource.data) {
            setForm(settingsResource.data);
        }
    }, [settingsResource.data]);

    useEffect(() => {
        const currentPlan = Array.isArray(billingPlanResource.data)
            ? billingPlanResource.data[0]
            : billingPlanResource.data;

        if (currentPlan && !billingDirty) {
            setBillingForm({
                id: currentPlan.id || '',
                name: currentPlan.name || 'CrediSync Mensual',
                description: currentPlan.description || '',
                priceMonthly: currentPlan.priceMonthly ?? 0,
                currency: currentPlan.currency || 'DOP'
            });
        }
    }, [billingPlanResource.data, billingDirty]);

    useEffect(() => {
        const loadPushStatus = async () => {
            setPushLoading(true);
            try {
                const response = await fetchPushStatus();
                const remote = response?.push || {};
                setPushStatusLoadError('');
                setPushStatus({
                    configured: Boolean(remote.configured),
                    supportedByDevice: Boolean(remote.supportedByDevice),
                    enabled: Boolean(remote.enabled),
                    subscriptionCount: Number(remote.subscriptionCount || 0),
                    timezone: String(remote.timezone || currentBrowserTimezone()),
                    vapidPublicKey: String(remote.vapidPublicKey || '')
                });
            } catch (error) {
                setPushStatusLoadError(String(error?.message || 'No se pudo leer /api/push/status'));
                setPushStatus((prev) => ({
                    ...prev,
                    configured: false,
                    supportedByDevice: isPushSupportedInBrowser(),
                    timezone: currentBrowserTimezone(),
                    vapidPublicKey: ''
                }));
            } finally {
                setPushLoading(false);
            }
        };

        loadPushStatus();
    }, []);

    const updateRoot = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const updateTenantDefault = (field, value) => {
        setForm((prev) => ({
            ...prev,
            tenantDefaults: {
                ...(prev.tenantDefaults || {}),
                [field]: value
            }
        }));
    };

    const updateRisk = (field, value) => {
        setForm((prev) => ({
            ...prev,
            riskModel: {
                ...(prev.riskModel || {}),
                [field]: value
            }
        }));
    };

    const updateBilling = (field, value) => {
        setBillingDirty(true);
        setBillingForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            setSaving(true);
            const payload = {
                platformName: String(form.platformName || '').trim(),
                supportEmail: String(form.supportEmail || '').trim().toLowerCase(),
                supportPhone: String(form.supportPhone || '').trim(),
                allowAdminRegistration: Boolean(form.allowAdminRegistration),
                newTenantStatus: 'active',
                tenantDefaults: {
                    personalLoanRate: toNumber(form.tenantDefaults?.personalLoanRate),
                    businessLoanRate: toNumber(form.tenantDefaults?.businessLoanRate),
                    mortgageLoanRate: toNumber(form.tenantDefaults?.mortgageLoanRate),
                    autoLoanRate: toNumber(form.tenantDefaults?.autoLoanRate),
                    latePenaltyRate: toNumber(form.tenantDefaults?.latePenaltyRate),
                    graceDays: Math.max(0, Math.trunc(toNumber(form.tenantDefaults?.graceDays))),
                    autoApprovalScore: toNumber(form.tenantDefaults?.autoApprovalScore),
                    maxDebtToIncome: toNumber(form.tenantDefaults?.maxDebtToIncome),
                    capitalBudget: Math.max(0, toNumber(form.tenantDefaults?.capitalBudget))
                },
                riskModel: {
                    initialScore: toNumber(form.riskModel?.initialScore),
                    onTimePaymentReward: toNumber(form.riskModel?.onTimePaymentReward),
                    keptPromiseReward: toNumber(form.riskModel?.keptPromiseReward),
                    paymentActivityReward: toNumber(form.riskModel?.paymentActivityReward),
                    paymentActivityCap: Math.max(0, toNumber(form.riskModel?.paymentActivityCap)),
                    latePaymentPenalty: Math.max(0, toNumber(form.riskModel?.latePaymentPenalty)),
                    brokenPromisePenalty: Math.max(0, toNumber(form.riskModel?.brokenPromisePenalty)),
                    pendingPromisePenalty: Math.max(0, toNumber(form.riskModel?.pendingPromisePenalty)),
                    overdueDayPenalty: Math.max(0, toNumber(form.riskModel?.overdueDayPenalty)),
                    overdueDayCap: Math.max(0, toNumber(form.riskModel?.overdueDayCap)),
                    overdueAccumulatedPenalty: Math.max(0, toNumber(form.riskModel?.overdueAccumulatedPenalty)),
                    overdueAccumulatedCap: Math.max(0, toNumber(form.riskModel?.overdueAccumulatedCap)),
                    lagInstallmentPenalty: Math.max(0, toNumber(form.riskModel?.lagInstallmentPenalty)),
                    noPaymentHistoryPenalty: Math.max(0, toNumber(form.riskModel?.noPaymentHistoryPenalty))
                }
            };

            const response = await apiRequest('/superadmin/settings', {
                method: 'PUT',
                body: payload
            });

            if (response?.settings) {
                setForm(response.settings);
                setSuperadminResource('superadmin:settings', response.settings);
            }

            invalidateSuperadminResource('superadmin:summary');

            showToast('Configuracion global actualizada');
        } catch (error) {
            showToast(error.message || 'No se pudo guardar la configuracion global');
        } finally {
            setSaving(false);
        }
    };

    const saveBillingModel = async () => {
        if (!billingForm.id) {
            showToast('No se encontro el plan base de suscripcion');
            return;
        }

        try {
            setBillingSaving(true);
            const response = await apiRequest(`/superadmin/plans/${billingForm.id}`, {
                method: 'PUT',
                body: {
                    id: billingForm.id,
                    code: 'credisync_monthly',
                    name: String(billingForm.name || 'CrediSync Mensual').trim(),
                    description: String(billingForm.description || '').trim(),
                    priceMonthly: Math.max(0, toNumber(billingForm.priceMonthly)),
                    currency: String(billingForm.currency || 'DOP').trim().toUpperCase(),
                    billingCycle: 'monthly',
                    isActive: true,
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
                    }
                }
            });

            if (response?.plan) {
                setBillingForm({
                    id: response.plan.id || billingForm.id,
                    name: response.plan.name || billingForm.name || 'CrediSync Mensual',
                    description: response.plan.description || billingForm.description || '',
                    priceMonthly: response.plan.priceMonthly ?? billingForm.priceMonthly ?? 0,
                    currency: response.plan.currency || billingForm.currency || 'DOP'
                });
                setSuperadminResource('superadmin:billing-plan', response.plan);
            }

            invalidateSuperadminResource('superadmin:plans');
            invalidateSuperadminResource('superadmin:billing-plan');
            invalidateSuperadminResource('superadmin:subscriptions');
            invalidateSuperadminResource('superadmin:subscriptions:bundle');
            invalidateSuperadminResource('superadmin:subscriptions:summary');
            await billingPlanResource.refresh();
            setBillingDirty(false);
            showToast('Modelo de suscripcion actualizado');
        } catch (error) {
            showToast(error.message || 'No se pudo guardar la mensualidad base');
        } finally {
            setBillingSaving(false);
        }
    };

    const enablePushNotifications = async () => {
        if (requiresStandaloneForPush) {
            showToast('En iPhone, abre CrediSync desde el icono de pantalla de inicio para activar push.');
            return;
        }

        if (!isPushSupportedInBrowser()) {
            showToast('Este dispositivo no soporta push web. En iPhone debes instalar CrediSync en pantalla de inicio.');
            return;
        }

        if (!pushStatus.supportedByDevice) {
            showToast('El servidor reporta que este dispositivo no es compatible para push web.');
            return;
        }

        if (!pushServerConfigured) {
            showToast('Push no configurado en servidor (faltan claves VAPID).');
            return;
        }

        try {
            setPushSaving(true);
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                showToast('Permiso de notificaciones no concedido.');
                return;
            }

            await subscribeToPush(pushStatus.vapidPublicKey, {
                timezone: currentBrowserTimezone(),
                deviceLabel: 'Superadmin principal'
            });
            const refreshed = await fetchPushStatus();
            const remote = refreshed?.push || {};
            setPushStatus((prev) => ({
                ...prev,
                enabled: Boolean(remote.enabled),
                subscriptionCount: Number(remote.subscriptionCount || 0),
                timezone: String(remote.timezone || currentBrowserTimezone())
            }));
            showToast('Notificaciones push activadas para el superadmin.');
        } catch (error) {
            showToast(error.message || 'No se pudo activar push en este dispositivo.');
        } finally {
            setPushSaving(false);
        }
    };

    const disablePushNotifications = async () => {
        try {
            setPushSaving(true);
            await unsubscribeFromPush();
            const refreshed = await fetchPushStatus();
            const remote = refreshed?.push || {};
            setPushStatus((prev) => ({
                ...prev,
                enabled: Boolean(remote.enabled),
                subscriptionCount: Number(remote.subscriptionCount || 0)
            }));
            showToast('Notificaciones push desactivadas para este dispositivo.');
        } catch (error) {
            showToast(error.message || 'No se pudo desactivar push.');
        } finally {
            setPushSaving(false);
        }
    };

    const sendPushTestNotification = async () => {
        try {
            setPushTesting(true);
            const response = await sendPushTest(currentBrowserTimezone());
            showToast(response?.message || 'Notificacion de prueba enviada');
        } catch (error) {
            showToast(error.message || 'No se pudo enviar la prueba push.');
        } finally {
            setPushTesting(false);
        }
    };

    if (loading && !settingsResource.hasCachedData) {
        return <section className="view"><div className="empty-state"><span className="material-symbols-outlined">hourglass_top</span><h4>Cargando configuracion global...</h4></div></section>;
    }

    const browserPushSupported = isPushSupportedInBrowser();
    const iosDevice = isIosDevice();
    const standaloneMode = isStandaloneMode();
    const requiresStandaloneForPush = iosDevice && !standaloneMode;
    const pushServerConfigured = pushStatus.configured && Boolean(pushStatus.vapidPublicKey);
    let pushBlockingMessage = '';
    if (!browserPushSupported) {
        pushBlockingMessage = 'Este navegador no soporta notificaciones push web.';
    } else if (requiresStandaloneForPush) {
        pushBlockingMessage = 'En iPhone debes abrir CrediSync desde el icono instalado en pantalla de inicio.';
    } else if (!pushStatus.supportedByDevice) {
        pushBlockingMessage = 'El servidor reporta que este dispositivo no es compatible para push web.';
    } else if (!pushServerConfigured) {
        pushBlockingMessage = 'El servidor actual no tiene PUSH_VAPID_PUBLIC_KEY/PUSH_VAPID_PRIVATE_KEY configuradas.';
    }

    return (
        <section className="view settings-view">
            <div className="settings-page-header">
                <div>
                    <h2>Configuracion superadmin</h2>
                    <p className="muted">Controla parametros globales de onboarding, riesgo y defaults para nuevos tenants.</p>
                    {refreshing && <p className="muted small">Actualizando configuracion...</p>}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="settings-layout">
                <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="settings-section-icon material-symbols-outlined">workspace_premium</span>
                        <div>
                            <h4 className="settings-section-title">Modelo de suscripcion</h4>
                            <p className="muted small">Una sola mensualidad con acceso completo. Usa este bloque para definir el monto base y el mensaje comercial.</p>
                        </div>
                    </div>
                    <div className="settings-section-body">
                        <div className="settings-grid cols-2">
                            <div className="settings-field"><label>Nombre comercial</label><div className="settings-input-wrap"><input value={billingForm.name || ''} onChange={(e) => updateBilling('name', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Mensualidad base</label><div className="settings-input-wrap"><input type="number" step="0.01" min="0" value={billingForm.priceMonthly ?? ''} onChange={(e) => updateBilling('priceMonthly', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Moneda</label><div className="settings-input-wrap"><select value={billingForm.currency || 'DOP'} onChange={(e) => updateBilling('currency', e.target.value)}><option value="DOP">DOP</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div></div>
                            <div className="settings-field" style={{ gridColumn: '1 / -1' }}><label>Descripcion</label><div className="settings-input-wrap"><textarea value={billingForm.description || ''} onChange={(e) => updateBilling('description', e.target.value)} /></div></div>
                        </div>
                        <p className="muted small">Vista previa: {moneyWithCurrency(toNumber(billingForm.priceMonthly), billingForm.currency || 'DOP')}</p>
                        <div className="settings-save-row">
                            <button type="button" className="btn btn-primary settings-save-btn" onClick={saveBillingModel} disabled={billingSaving}>
                                <span className="material-symbols-outlined">payments</span>
                                {billingSaving ? 'Guardando...' : 'Guardar mensualidad base'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="settings-section-icon material-symbols-outlined">public</span>
                        <div>
                            <h4 className="settings-section-title">Plataforma</h4>
                            <p className="muted small">Identidad y reglas de registro.</p>
                        </div>
                    </div>
                    <div className="settings-section-body">
                        <div className="settings-grid cols-2">
                            <div className="settings-field"><label>Nombre plataforma</label><div className="settings-input-wrap"><input value={form.platformName || ''} onChange={(e) => updateRoot('platformName', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Email soporte</label><div className="settings-input-wrap"><input type="email" value={form.supportEmail || ''} onChange={(e) => updateRoot('supportEmail', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Telefono soporte</label><div className="settings-input-wrap"><input value={form.supportPhone || ''} onChange={(e) => updateRoot('supportPhone', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Estado inicial de nuevos tenants</label><div className="settings-input-wrap"><input value="Activo" readOnly /></div></div>
                            <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                                <label className="superadmin-toggle-row">
                                    <input type="checkbox" checked={Boolean(form.allowAdminRegistration)} onChange={(e) => updateRoot('allowAdminRegistration', e.target.checked)} />
                                    <span>Permitir auto-registro de administradores</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="settings-section-icon material-symbols-outlined">notifications_active</span>
                        <div>
                            <h4 className="settings-section-title">Notificaciones push (PWA)</h4>
                            <p className="muted small">Activa push en tu dispositivo de superadmin para probar altas de nuevos clientes y alertas operativas aun con la app cerrada.</p>
                        </div>
                    </div>
                    <div className="settings-section-body">
                        <div className="settings-grid cols-2">
                            <div className="settings-field">
                                <label>Estado push</label>
                                <div className="settings-input-wrap">
                                    <input value={pushLoading ? 'Cargando...' : pushStatus.enabled ? 'Activo' : 'Inactivo'} readOnly />
                                </div>
                            </div>
                            <div className="settings-field">
                                <label>Dispositivos activos</label>
                                <div className="settings-input-wrap">
                                    <input value={String(pushStatus.subscriptionCount || 0)} readOnly />
                                </div>
                            </div>
                            <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Zona horaria detectada</label>
                                <div className="settings-input-wrap">
                                    <input value={pushStatus.timezone || currentBrowserTimezone()} readOnly />
                                </div>
                            </div>
                        </div>

                        {pushBlockingMessage && <p className="muted small" style={{ marginTop: '0.75rem' }}>{pushBlockingMessage}</p>}
                        {pushStatusLoadError && <p className="muted small" style={{ marginTop: '0.35rem' }}>No se pudo leer estado push del servidor: {pushStatusLoadError}</p>}

                        <div className="settings-save-row" style={{ justifyContent: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-primary" onClick={enablePushNotifications} disabled={pushSaving || pushLoading}>
                                {pushSaving ? 'Activando...' : 'Activar push'}
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={disablePushNotifications} disabled={pushSaving || pushLoading || !pushStatus.enabled}>
                                Desactivar push
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={sendPushTestNotification} disabled={pushTesting || !pushStatus.enabled}>
                                {pushTesting ? 'Enviando prueba...' : 'Enviar prueba push'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="settings-section-icon material-symbols-outlined">tune</span>
                        <div>
                            <h4 className="settings-section-title">Defaults para nuevos tenants</h4>
                            <p className="muted small">Se aplican cuando se crea o reactiva un tenant.</p>
                        </div>
                    </div>
                    <div className="settings-section-body">
                        <div className="settings-grid cols-2">
                            <div className="settings-field"><label>Tasa personal (%)</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.tenantDefaults?.personalLoanRate ?? ''} onChange={(e) => updateTenantDefault('personalLoanRate', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Tasa negocio (%)</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.tenantDefaults?.businessLoanRate ?? ''} onChange={(e) => updateTenantDefault('businessLoanRate', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Tasa hipotecario (%)</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.tenantDefaults?.mortgageLoanRate ?? ''} onChange={(e) => updateTenantDefault('mortgageLoanRate', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Tasa vehicular (%)</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.tenantDefaults?.autoLoanRate ?? ''} onChange={(e) => updateTenantDefault('autoLoanRate', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Mora diaria (%)</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.tenantDefaults?.latePenaltyRate ?? ''} onChange={(e) => updateTenantDefault('latePenaltyRate', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Dias de gracia</label><div className="settings-input-wrap"><input type="number" step="1" value={form.tenantDefaults?.graceDays ?? ''} onChange={(e) => updateTenantDefault('graceDays', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Score autoaprobacion</label><div className="settings-input-wrap"><input type="number" step="1" value={form.tenantDefaults?.autoApprovalScore ?? ''} onChange={(e) => updateTenantDefault('autoApprovalScore', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Max deuda/ingreso (%)</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.tenantDefaults?.maxDebtToIncome ?? ''} onChange={(e) => updateTenantDefault('maxDebtToIncome', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Capital default</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.tenantDefaults?.capitalBudget ?? ''} onChange={(e) => updateTenantDefault('capitalBudget', e.target.value)} /></div></div>
                        </div>
                    </div>
                </div>

                <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="settings-section-icon material-symbols-outlined">monitoring</span>
                        <div>
                            <h4 className="settings-section-title">Modelo de riesgo global</h4>
                            <p className="muted small">Ajusta incentivos y penalidades del score.</p>
                        </div>
                    </div>
                    <div className="settings-section-body">
                        <div className="settings-grid cols-2">
                            <div className="settings-field"><label>Score inicial</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.initialScore ?? ''} onChange={(e) => updateRisk('initialScore', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Recompensa pago puntual</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.onTimePaymentReward ?? ''} onChange={(e) => updateRisk('onTimePaymentReward', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Recompensa promesa cumplida</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.keptPromiseReward ?? ''} onChange={(e) => updateRisk('keptPromiseReward', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Recompensa actividad pago</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.paymentActivityReward ?? ''} onChange={(e) => updateRisk('paymentActivityReward', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Tope actividad pago</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.paymentActivityCap ?? ''} onChange={(e) => updateRisk('paymentActivityCap', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Penalidad pago tarde</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.latePaymentPenalty ?? ''} onChange={(e) => updateRisk('latePaymentPenalty', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Penalidad promesa rota</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.brokenPromisePenalty ?? ''} onChange={(e) => updateRisk('brokenPromisePenalty', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Penalidad promesa pendiente</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.pendingPromisePenalty ?? ''} onChange={(e) => updateRisk('pendingPromisePenalty', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Penalidad por dia vencido</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.overdueDayPenalty ?? ''} onChange={(e) => updateRisk('overdueDayPenalty', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Tope dias vencidos</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.overdueDayCap ?? ''} onChange={(e) => updateRisk('overdueDayCap', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Penalidad mora acumulada</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.overdueAccumulatedPenalty ?? ''} onChange={(e) => updateRisk('overdueAccumulatedPenalty', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Tope mora acumulada</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.overdueAccumulatedCap ?? ''} onChange={(e) => updateRisk('overdueAccumulatedCap', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Penalidad rezago cuotas</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.lagInstallmentPenalty ?? ''} onChange={(e) => updateRisk('lagInstallmentPenalty', e.target.value)} /></div></div>
                            <div className="settings-field"><label>Penalidad sin historial pago</label><div className="settings-input-wrap"><input type="number" step="0.01" value={form.riskModel?.noPaymentHistoryPenalty ?? ''} onChange={(e) => updateRisk('noPaymentHistoryPenalty', e.target.value)} /></div></div>
                        </div>
                    </div>
                </div>

                <div className="settings-save-row">
                    <button type="submit" className="btn btn-primary settings-save-btn" disabled={saving}>
                        <span className="material-symbols-outlined">save</span>
                        {saving ? 'Guardando...' : 'Guardar configuracion global'}
                    </button>
                </div>
            </form>
        </section>
    );
}
