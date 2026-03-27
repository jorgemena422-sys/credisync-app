import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../utils/api';
import { formatDate } from '../utils/helpers';
import {
    currentBrowserTimezone,
    fetchPushStatus,
    isPushSupportedInBrowser,
    sendPushTest,
    subscribeToPush,
    unsubscribeFromPush
} from '../utils/push';

function SettingsSection({ icon, title, description, children }) {
    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <span className="settings-section-icon material-symbols-outlined">{icon}</span>
                <div>
                    <h4 className="settings-section-title">{title}</h4>
                    {description && <p className="muted small">{description}</p>}
                </div>
            </div>
            <div className="settings-section-body">{children}</div>
        </div>
    );
}

function SettingsField({ label, id, suffix, ...inputProps }) {
    return (
        <div className="settings-field">
            <label htmlFor={id}>{label}</label>
            <div className="settings-input-wrap">
                <input id={id} {...inputProps} />
                {suffix && <span className="settings-input-suffix">{suffix}</span>}
            </div>
        </div>
    );
}

function subscriptionStatusMeta(status) {
    const normalized = String(status || '').toLowerCase();
    const map = {
        active: { label: 'Activa', className: 'status-active' },
        suspended: { label: 'Suspendida', className: 'status-overdue' }
    };
    return map[normalized] || { label: normalized || 'Sin estado', className: 'status-inactive' };
}

function usageRatio(used, limit) {
    const safeLimit = Number(limit || 0);
    if (safeLimit <= 0) {
        return 0;
    }
    return Math.min((Number(used || 0) / safeLimit) * 100, 100);
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

export default function Settings() {
    const { state, bootstrapState, applyTenantSettings } = useApp();
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [calendarSaving, setCalendarSaving] = useState(false);
    const [calendarRotating, setCalendarRotating] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [pushSaving, setPushSaving] = useState(false);
    const [pushTesting, setPushTesting] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [formData, setFormData] = useState({
        personalLoanRate: '',
        businessLoanRate: '',
        mortgageLoanRate: '',
        autoLoanRate: '',
        latePenaltyRate: '',
        graceDays: '',
        autoApprovalScore: '',
        maxDebtToIncome: '',
        capitalBudget: '',
        currency: 'DOP'
    });
    const [calendarForm, setCalendarForm] = useState({
        enabled: true,
        timezone: 'America/Santo_Domingo'
    });
    const [calendarLinks, setCalendarLinks] = useState({
        feedUrl: '',
        webcalUrl: ''
    });
    const [pushStatus, setPushStatus] = useState({
        configured: false,
        supportedByDevice: false,
        enabled: false,
        subscriptionCount: 0,
        timezone: 'America/Santo_Domingo',
        vapidPublicKey: ''
    });
    const [pushStatusLoadError, setPushStatusLoadError] = useState('');
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const isReadOnlySubscription = String(state?.subscription?.status || '').toLowerCase() === 'suspended';
    const calendarFeatureEnabled = Boolean(state?.subscription?.features?.calendarIcsEnabled);
    const subscription = state?.subscription || {};
    const subscriptionStatus = subscriptionStatusMeta(subscription.status);
    const usageCards = [
        {
            id: 'users',
            label: 'Usuarios',
            used: Number(subscription?.usage?.users || 0),
            limit: Number(subscription?.limits?.maxUsers || 0)
        },
        {
            id: 'customers',
            label: 'Clientes',
            used: Number(subscription?.usage?.customers || 0),
            limit: Number(subscription?.limits?.maxCustomers || 0)
        },
        {
            id: 'active-loans',
            label: 'Prestamos activos',
            used: Number(subscription?.usage?.activeLoans || 0),
            limit: Number(subscription?.limits?.maxActiveLoans || 0)
        }
    ];

    useEffect(() => {
        if (state.settings) {
            setFormData({
                personalLoanRate: state.settings.personalLoanRate ?? '',
                businessLoanRate: state.settings.businessLoanRate ?? '',
                mortgageLoanRate: state.settings.mortgageLoanRate ?? '',
                autoLoanRate: state.settings.autoLoanRate ?? '',
                latePenaltyRate: state.settings.latePenaltyRate ?? '',
                graceDays: state.settings.graceDays ?? '',
                autoApprovalScore: state.settings.autoApprovalScore ?? '',
                maxDebtToIncome: state.settings.maxDebtToIncome ?? '',
                capitalBudget: state.settings.capitalBudget ?? '',
                currency: state.settings.currency ?? 'DOP'
            });
        }
    }, [state.settings]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (event) => {
        const { name, value } = event.target;
        setPasswordForm((prev) => ({ ...prev, [name]: value }));
    };

    useEffect(() => {
        const loadCalendar = async () => {
            if (!calendarFeatureEnabled) {
                setCalendarLinks({ feedUrl: '', webcalUrl: '' });
                return;
            }

            try {
                const response = await apiRequest('/user-calendar');
                setCalendarForm({
                    enabled: response?.calendar?.enabled !== false,
                    timezone: response?.calendar?.timezone || 'America/Santo_Domingo'
                });
                setCalendarLinks({
                    feedUrl: response?.feedUrl || '',
                    webcalUrl: response?.webcalUrl || ''
                });
            } catch {
                setCalendarLinks({ feedUrl: '', webcalUrl: '' });
            }
        };

        loadCalendar();
    }, [calendarFeatureEnabled]);

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

    const handleSave = async (event) => {
        event.preventDefault();
        if (isReadOnlySubscription) {
            showToast('Tu cuenta esta en modo solo lectura. Contacta al superadministrador para reactivarla.');
            return;
        }
        try {
            setSaving(true);
            const payload = {
                personalLoanRate: Number(formData.personalLoanRate) || 0,
                businessLoanRate: Number(formData.businessLoanRate) || 0,
                mortgageLoanRate: Number(formData.mortgageLoanRate) || 0,
                autoLoanRate: Number(formData.autoLoanRate) || 0,
                latePenaltyRate: Number(formData.latePenaltyRate) || 0,
                graceDays: Number(formData.graceDays) || 0,
                autoApprovalScore: Number(formData.autoApprovalScore) || 0,
                maxDebtToIncome: Number(formData.maxDebtToIncome) || 0,
                capitalBudget: Number(formData.capitalBudget) || 0,
                currency: formData.currency || 'DOP'
            };

            const response = await apiRequest('/settings', { method: 'PUT', body: payload });
            if (response?.settings) {
                const nextSettings = {
                    personalLoanRate: response.settings.personalLoanRate ?? payload.personalLoanRate,
                    businessLoanRate: response.settings.businessLoanRate ?? payload.businessLoanRate,
                    mortgageLoanRate: response.settings.mortgageLoanRate ?? payload.mortgageLoanRate,
                    autoLoanRate: response.settings.autoLoanRate ?? payload.autoLoanRate,
                    latePenaltyRate: response.settings.latePenaltyRate ?? payload.latePenaltyRate,
                    graceDays: response.settings.graceDays ?? payload.graceDays,
                    autoApprovalScore: response.settings.autoApprovalScore ?? payload.autoApprovalScore,
                    maxDebtToIncome: response.settings.maxDebtToIncome ?? payload.maxDebtToIncome,
                    capitalBudget: response.settings.capitalBudget ?? payload.capitalBudget,
                    currency: response.settings.currency ?? payload.currency
                };
                setFormData((prev) => ({
                    ...prev,
                    ...nextSettings
                }));
                applyTenantSettings(nextSettings);
            }
            showToast('Configuracion guardada correctamente');
            await bootstrapState({ silent: true });
        } catch (error) {
            showToast(error.message || 'Error al guardar configuracion');
        } finally {
            setSaving(false);
        }
    };

    const saveCalendarSettings = async () => {
        if (!calendarFeatureEnabled) {
            showToast('Sincronizacion ICS es un feature de pago de tu plan actual.');
            return;
        }
        if (isReadOnlySubscription) {
            showToast('Tu cuenta esta en modo solo lectura. Contacta al superadministrador para reactivarla.');
            return;
        }
        try {
            setCalendarSaving(true);
            const response = await apiRequest('/user-calendar', {
                method: 'PUT',
                body: {
                    enabled: Boolean(calendarForm.enabled),
                    timezone: calendarForm.timezone
                }
            });

            setCalendarForm({
                enabled: response?.calendar?.enabled !== false,
                timezone: response?.calendar?.timezone || calendarForm.timezone
            });
            setCalendarLinks({
                feedUrl: response?.feedUrl || '',
                webcalUrl: response?.webcalUrl || ''
            });
            showToast('Sincronizacion de calendario actualizada');
        } catch (error) {
            showToast(error.message || 'No se pudo guardar la configuracion de calendario');
        } finally {
            setCalendarSaving(false);
        }
    };

    const rotateCalendarToken = async () => {
        if (!calendarFeatureEnabled) {
            showToast('Sincronizacion ICS es un feature de pago de tu plan actual.');
            return;
        }
        if (isReadOnlySubscription) {
            showToast('Tu cuenta esta en modo solo lectura. Contacta al superadministrador para reactivarla.');
            return;
        }
        try {
            setCalendarRotating(true);
            const response = await apiRequest('/user-calendar/rotate-token', { method: 'POST' });
            setCalendarLinks({
                feedUrl: response?.feedUrl || '',
                webcalUrl: response?.webcalUrl || ''
            });
            showToast('Se genero un nuevo enlace de calendario');
        } catch (error) {
            showToast(error.message || 'No se pudo rotar el enlace del calendario');
        } finally {
            setCalendarRotating(false);
        }
    };

    const copyCalendarLink = async (url) => {
        const value = String(url || '').trim();
        if (!value) {
            showToast('Guarda la configuracion para generar tu enlace ICS');
            return;
        }

        if (/:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)(:|\/|$)/i.test(value)) {
            showToast('Este enlace usa localhost y no funcionara en iPhone. Configura APP_PUBLIC_URL con un dominio o IP accesible.');
        }

        if (!navigator?.clipboard) {
            showToast('Clipboard no disponible en este navegador');
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            showToast('Enlace copiado');
        } catch {
            showToast('No se pudo copiar automaticamente');
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
                deviceLabel: 'Dispositivo principal'
            });
            const refreshed = await fetchPushStatus();
            const remote = refreshed?.push || {};
            setPushStatus((prev) => ({
                ...prev,
                enabled: Boolean(remote.enabled),
                subscriptionCount: Number(remote.subscriptionCount || 0),
                timezone: String(remote.timezone || currentBrowserTimezone())
            }));
            showToast('Notificaciones push activadas.');
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

    const saveNewPassword = async () => {
        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            showToast('Completa los tres campos de contrasena');
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            showToast('La nueva contrasena debe tener al menos 8 caracteres');
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showToast('La confirmacion de contrasena no coincide');
            return;
        }

        try {
            setPasswordSaving(true);
            const response = await apiRequest('/auth/change-password', {
                method: 'POST',
                body: {
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                }
            });
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            showToast(response?.message || 'Contrasena actualizada correctamente');
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar la contrasena');
        } finally {
            setPasswordSaving(false);
        }
    };

    const usesLocalhostCalendarUrl = /:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)(:|\/|$)/i.test(
        String(calendarLinks.feedUrl || '')
    );
    const browserPushSupported = isPushSupportedInBrowser();
    const iosDevice = isIosDevice();
    const standaloneMode = isStandaloneMode();
    const requiresStandaloneForPush = iosDevice && !standaloneMode;
    const pushServerConfigured = pushStatus.configured && Boolean(pushStatus.vapidPublicKey);
    const pushReady = pushServerConfigured && pushStatus.supportedByDevice && browserPushSupported && !requiresStandaloneForPush;
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
        <section id="view-settings" className="view settings-view">
            <div className="settings-page-header">
                <div>
                    <h2>Configuracion</h2>
                    <p className="muted">Ajusta los parametros globales de originacion, cobranza y capital.</p>
                    <p className="muted small">Plan activo: {state?.subscription?.planName || 'Starter'}</p>
                    {isReadOnlySubscription && <p className="muted small">Modo solo lectura activo por suscripcion suspendida.</p>}
                </div>
            </div>

            <form onSubmit={handleSave} className="settings-layout">
                <SettingsSection
                    icon="lock"
                    title="Seguridad de acceso"
                    description="Actualiza tu contrasena sin depender de soporte o del superadministrador."
                >
                    <div className="settings-grid cols-2">
                        <SettingsField
                            label="Contrasena actual"
                            id="settings-current-password"
                            name="currentPassword"
                            type="password"
                            autoComplete="current-password"
                            value={passwordForm.currentPassword}
                            onChange={handlePasswordChange}
                        />
                        <div />
                        <SettingsField
                            label="Nueva contrasena"
                            id="settings-new-password"
                            name="newPassword"
                            type="password"
                            autoComplete="new-password"
                            value={passwordForm.newPassword}
                            onChange={handlePasswordChange}
                        />
                        <SettingsField
                            label="Confirmar nueva contrasena"
                            id="settings-confirm-password"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            value={passwordForm.confirmPassword}
                            onChange={handlePasswordChange}
                        />
                    </div>
                    <p className="muted small" style={{ marginTop: '0.9rem' }}>
                        Usa al menos 8 caracteres. Si olvidaste tu clave por completo, tambien puedes usar el flujo de recuperacion desde el login.
                    </p>
                    <div className="settings-save-row" style={{ justifyContent: 'flex-start' }}>
                        <button type="button" className="btn btn-primary" onClick={saveNewPassword} disabled={passwordSaving}>
                            {passwordSaving ? 'Actualizando...' : 'Actualizar contrasena'}
                        </button>
                    </div>
                </SettingsSection>

                <SettingsSection
                    icon="workspace_premium"
                    title="Plan y capacidad"
                    description="Consulta el estado de tu suscripcion y el uso actual del workspace."
                >
                    <div className="settings-plan-grid">
                        <article className="settings-plan-card">
                            <p className="eyebrow">Plan actual</p>
                            <h3>{subscription?.planName || 'Starter'}</h3>
                            <div className="settings-plan-meta">
                                <span className={`status ${subscriptionStatus.className}`}>{subscriptionStatus.label}</span>
                                <span className="muted small">{subscription?.billingCycle === 'yearly' ? 'Facturacion anual' : 'Facturacion mensual'}</span>
                            </div>
                            <p className="muted small">
                                {subscription?.nextBillingDate
                                    ? `Proxima renovacion: ${formatDate(subscription.nextBillingDate)}`
                                    : 'Sin fecha de renovacion registrada'}
                            </p>
                        </article>

                        <article className="settings-plan-card settings-plan-card-usage">
                            <p className="eyebrow">Uso del plan</p>
                            <div className="settings-usage-list">
                                {usageCards.map((item) => {
                                    const ratio = usageRatio(item.used, item.limit);
                                    const nearLimit = ratio >= 85;
                                    return (
                                        <div key={item.id} className="settings-usage-item">
                                            <div className="settings-usage-head">
                                                <strong>{item.label}</strong>
                                                <span className={`settings-usage-value ${nearLimit ? 'is-warning' : ''}`}>
                                                    {item.used}/{item.limit}
                                                </span>
                                            </div>
                                            <div className="settings-usage-bar" aria-hidden="true">
                                                <span style={{ width: `${ratio}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </article>
                    </div>
                </SettingsSection>

                <SettingsSection
                    icon="percent"
                    title="Tasas de interes"
                    description="Define las tasas anuales por tipo de prestamo."
                >
                    <div className="settings-grid cols-2">
                        <SettingsField
                            label="Prestamo Personal"
                            id="settings-rate-personal"
                            name="personalLoanRate"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.personalLoanRate}
                            onChange={handleChange}
                            suffix="%"
                            required
                        />
                        <SettingsField
                            label="Negocio"
                            id="settings-rate-business"
                            name="businessLoanRate"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.businessLoanRate}
                            onChange={handleChange}
                            suffix="%"
                            required
                        />
                        <SettingsField
                            label="Hipotecario"
                            id="settings-rate-mortgage"
                            name="mortgageLoanRate"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.mortgageLoanRate}
                            onChange={handleChange}
                            suffix="%"
                            required
                        />
                        <SettingsField
                            label="Vehicular"
                            id="settings-rate-auto"
                            name="autoLoanRate"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.autoLoanRate}
                            onChange={handleChange}
                            suffix="%"
                            required
                        />
                    </div>
                </SettingsSection>

                <SettingsSection
                    icon="gavel"
                    title="Penalidades y plazos"
                    description="Configura mora diaria sobre cuota vencida y periodos de gracia."
                >
                    <div className="settings-grid cols-2">
                        <SettingsField
                            label="Penalidad diaria por mora"
                            id="settings-penalty"
                            name="latePenaltyRate"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.latePenaltyRate}
                            onChange={handleChange}
                            suffix="%"
                            required
                        />
                        <SettingsField
                            label="Dias de gracia"
                            id="settings-grace"
                            name="graceDays"
                            type="number"
                            min="0"
                            value={formData.graceDays}
                            onChange={handleChange}
                            suffix="dias"
                            required
                        />
                    </div>
                    <p className="muted small">
                        Formula aplicada: si se supera la gracia, mora = cuota vencida x (% / 100) x dias desde el vencimiento.
                    </p>
                </SettingsSection>

                <SettingsSection
                    icon="account_balance"
                    title="Capital"
                    description="Establece el presupuesto disponible para colocacion."
                >
                    <div className="settings-grid cols-2">
                        <SettingsField
                            label="Presupuesto de capital asignado"
                            id="settings-budget"
                            name="capitalBudget"
                            type="number"
                            step="1000"
                            min="0"
                            value={formData.capitalBudget}
                            onChange={handleChange}
                            suffix={formData.currency}
                            required
                        />
                        <div className="settings-field">
                            <label htmlFor="settings-currency">Moneda</label>
                            <div className="settings-input-wrap">
                                <select
                                    id="settings-currency"
                                    name="currency"
                                    value={formData.currency}
                                    onChange={handleChange}
                                >
                                    <option value="DOP">DOP - Peso dominicano</option>
                                    <option value="USD">USD - Dolar estadounidense</option>
                                    <option value="EUR">EUR - Euro</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection
                    icon="event"
                    title="Calendario personal (ICS)"
                    description="Sincroniza tu calendario personal como canal adicional de seguimiento."
                >
                    {!calendarFeatureEnabled ? (
                        <div className="empty-state compact-empty-state">
                            <span className="material-symbols-outlined">workspace_premium</span>
                            <h4>Sincronizacion ICS no incluida</h4>
                            <p>Esta funcion es un feature de pago. Solicita al superadministrador activar un plan que incluya calendario ICS.</p>
                        </div>
                    ) : (
                        <>
                            <p className="muted small" style={{ marginTop: 0, marginBottom: '0.8rem' }}>
                                En iPhone usa preferiblemente el enlace webcal y agregalo desde la app Calendario. Este canal se mantiene como complemento de las notificaciones push.
                            </p>
                            <div className="settings-grid cols-2">
                                <div className="settings-field">
                                    <label htmlFor="settings-calendar-enabled">Estado de sincronizacion</label>
                                    <div className="settings-input-wrap">
                                        <select
                                            id="settings-calendar-enabled"
                                            value={calendarForm.enabled ? 'on' : 'off'}
                                            onChange={(event) => setCalendarForm((prev) => ({ ...prev, enabled: event.target.value === 'on' }))}
                                        >
                                            <option value="on">Activada</option>
                                            <option value="off">Desactivada</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="settings-field">
                                    <label htmlFor="settings-calendar-timezone">Zona horaria</label>
                                    <div className="settings-input-wrap">
                                        <input
                                            id="settings-calendar-timezone"
                                            value={calendarForm.timezone}
                                            onChange={(event) => setCalendarForm((prev) => ({ ...prev, timezone: event.target.value }))}
                                            placeholder="America/Santo_Domingo"
                                        />
                                    </div>
                                </div>
                                <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                                    <label htmlFor="settings-calendar-feed">Enlace ICS</label>
                                    <div className="settings-input-wrap">
                                        <input
                                            id="settings-calendar-feed"
                                            value={calendarLinks.feedUrl || 'Guarda para generar tu enlace'}
                                            readOnly
                                        />
                                    </div>
                                </div>
                                <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                                    <label htmlFor="settings-calendar-webcal">Enlace webcal</label>
                                    <div className="settings-input-wrap">
                                        <input
                                            id="settings-calendar-webcal"
                                            value={calendarLinks.webcalUrl || 'Guarda para generar tu enlace'}
                                            readOnly
                                        />
                                    </div>
                                </div>
                                {usesLocalhostCalendarUrl && (
                                    <p className="muted small" style={{ gridColumn: '1 / -1', marginTop: '-0.1rem' }}>
                                        El enlace actual usa localhost. Para iPhone debes usar un dominio o IP publica accesible en APP_PUBLIC_URL.
                                    </p>
                                )}
                            </div>
                            <div className="settings-save-row" style={{ justifyContent: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}>
                                <button type="button" className="btn btn-primary" onClick={saveCalendarSettings} disabled={calendarSaving || isReadOnlySubscription}>
                                    {calendarSaving ? 'Guardando...' : 'Guardar sincronizacion'}
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={() => copyCalendarLink(calendarLinks.feedUrl)}>
                                    Copiar ICS
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={() => copyCalendarLink(calendarLinks.webcalUrl)}>
                                    Copiar webcal
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={rotateCalendarToken} disabled={calendarRotating || isReadOnlySubscription}>
                                    {calendarRotating ? 'Rotando...' : 'Rotar enlace'}
                                </button>
                            </div>
                        </>
                    )}
                </SettingsSection>

                <SettingsSection
                    icon="notifications_active"
                    title="Recordatorios push (PWA)"
                    description="Resumen del dia con acceso directo a cobros, mora y centro de alertas desde la notificacion push."
                >
                    <div className="settings-grid cols-2">
                        <div className="settings-field">
                            <label>Estado push</label>
                            <div className="settings-input-wrap">
                                <input
                                    value={pushLoading ? 'Cargando...' : pushStatus.enabled ? 'Activo' : 'Inactivo'}
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>

                    {pushBlockingMessage && (
                        <p className="muted small" style={{ marginTop: '0.75rem' }}>
                            {pushBlockingMessage}
                        </p>
                    )}

                    {pushStatusLoadError && (
                        <p className="muted small" style={{ marginTop: '0.35rem' }}>
                            No se pudo leer estado push del servidor: {pushStatusLoadError}
                        </p>
                    )}

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
                </SettingsSection>

                <div className="settings-save-row">
                    <button type="submit" className="btn btn-primary settings-save-btn" disabled={saving || isReadOnlySubscription}>
                        <span className="material-symbols-outlined">save</span>
                        {saving ? 'Guardando...' : 'Guardar configuracion'}
                    </button>
                </div>
            </form>
        </section>
    );
}
