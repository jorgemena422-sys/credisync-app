import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../utils/api';

function defaultForm() {
    return {
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
    };
}

function Field({ label, children, hint }) {
    return (
        <div className="form-group">
            <label>{label}</label>
            {children}
            {hint && <p className="muted tiny form-hint">{hint}</p>}
        </div>
    );
}

export default function SuperadminSettings() {
    const { showToast } = useToast();
    const [formData, setFormData] = useState(defaultForm());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                setLoading(true);
                const response = await apiRequest('/superadmin/settings');
                setFormData(response.settings || defaultForm());
            } catch (error) {
                showToast(error.message || 'No fue posible cargar la configuracion global');
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, [showToast]);

    const handleRootChange = (event) => {
        const { name, type, checked, value } = event.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleTenantDefaultChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({
            ...prev,
            tenantDefaults: {
                ...prev.tenantDefaults,
                [name]: value
            }
        }));
    };

    const handleRiskModelChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({
            ...prev,
            riskModel: {
                ...prev.riskModel,
                [name]: value
            }
        }));
    };

    const payload = useMemo(() => ({
        platformName: formData.platformName,
        supportEmail: formData.supportEmail,
        supportPhone: formData.supportPhone,
        allowAdminRegistration: Boolean(formData.allowAdminRegistration),
        newTenantStatus: formData.newTenantStatus,
        tenantDefaults: {
            personalLoanRate: Number(formData.tenantDefaults.personalLoanRate) || 0,
            businessLoanRate: Number(formData.tenantDefaults.businessLoanRate) || 0,
            mortgageLoanRate: Number(formData.tenantDefaults.mortgageLoanRate) || 0,
            autoLoanRate: Number(formData.tenantDefaults.autoLoanRate) || 0,
            latePenaltyRate: Number(formData.tenantDefaults.latePenaltyRate) || 0,
            graceDays: Number(formData.tenantDefaults.graceDays) || 0,
            autoApprovalScore: Number(formData.tenantDefaults.autoApprovalScore) || 0,
            maxDebtToIncome: Number(formData.tenantDefaults.maxDebtToIncome) || 0,
            capitalBudget: Number(formData.tenantDefaults.capitalBudget) || 0
        },
        riskModel: {
            initialScore: Number(formData.riskModel.initialScore) || 0,
            onTimePaymentReward: Number(formData.riskModel.onTimePaymentReward) || 0,
            keptPromiseReward: Number(formData.riskModel.keptPromiseReward) || 0,
            paymentActivityReward: Number(formData.riskModel.paymentActivityReward) || 0,
            paymentActivityCap: Number(formData.riskModel.paymentActivityCap) || 0,
            latePaymentPenalty: Number(formData.riskModel.latePaymentPenalty) || 0,
            brokenPromisePenalty: Number(formData.riskModel.brokenPromisePenalty) || 0,
            pendingPromisePenalty: Number(formData.riskModel.pendingPromisePenalty) || 0,
            overdueDayPenalty: Number(formData.riskModel.overdueDayPenalty) || 0,
            overdueDayCap: Number(formData.riskModel.overdueDayCap) || 0,
            overdueAccumulatedPenalty: Number(formData.riskModel.overdueAccumulatedPenalty) || 0,
            overdueAccumulatedCap: Number(formData.riskModel.overdueAccumulatedCap) || 0,
            lagInstallmentPenalty: Number(formData.riskModel.lagInstallmentPenalty) || 0,
            noPaymentHistoryPenalty: Number(formData.riskModel.noPaymentHistoryPenalty) || 0
        }
    }), [formData]);

    const handleSave = async (event) => {
        event.preventDefault();
        try {
            setSaving(true);
            const response = await apiRequest('/superadmin/settings', {
                method: 'PUT',
                body: payload
            });
            setFormData(response.settings || formData);
            showToast('Configuracion global actualizada');
        } catch (error) {
            showToast(error.message || 'No fue posible guardar la configuracion global');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <section className="view"><div className="empty-state"><span className="material-symbols-outlined">hourglass_top</span><h4>Cargando configuracion global...</h4></div></section>;
    }

    return (
        <section className="view">
            <div className="card section-stack superadmin-head">
                <div className="section-head split">
                    <div>
                        <h3>Configuracion global</h3>
                        <p className="muted">Controla parametros persistentes de plataforma y defaults que se aplican al provisionar nuevos tenants.</p>
                    </div>
                    <span className="status status-active">Persistencia activa</span>
                </div>
            </div>

            <form className="superadmin-layout" onSubmit={handleSave}>
                <div className="card section-stack superadmin-main-panel">
                    <div className="section-head">
                        <h3>Identidad y acceso</h3>
                    </div>

                    <fieldset className="form-section">
                        <h5 className="form-section-title">Identidad de plataforma</h5>
                        <div className="form-grid cols-2">
                            <Field label="Nombre de plataforma">
                                <input name="platformName" value={formData.platformName} onChange={handleRootChange} />
                            </Field>
                            <Field label="Estado por defecto de nuevos tenants">
                                <select name="newTenantStatus" value={formData.newTenantStatus} onChange={handleRootChange}>
                                    <option value="active">Activo</option>
                                    <option value="inactive">Inactivo</option>
                                </select>
                            </Field>
                            <Field label="Correo de soporte">
                                <input name="supportEmail" type="email" value={formData.supportEmail} onChange={handleRootChange} />
                            </Field>
                            <Field label="Telefono de soporte">
                                <input name="supportPhone" value={formData.supportPhone} onChange={handleRootChange} />
                            </Field>
                        </div>
                    </fieldset>

                    <fieldset className="form-section">
                        <h5 className="form-section-title">Provisionamiento y registro</h5>
                        <label className="superadmin-toggle-row">
                            <input
                                type="checkbox"
                                name="allowAdminRegistration"
                                checked={Boolean(formData.allowAdminRegistration)}
                                onChange={handleRootChange}
                            />
                            <div>
                                <strong>Permitir registro de administradores</strong>
                                <p className="muted small">Si se desactiva, solo el superadministrador podra habilitar nuevas cuentas admin.</p>
                            </div>
                        </label>
                    </fieldset>

                    <fieldset className="form-section">
                        <h5 className="form-section-title">Defaults para nuevos tenants</h5>
                        <div className="form-grid cols-3">
                            <Field label="Tasa personal (%)"><input name="personalLoanRate" type="number" step="0.01" value={formData.tenantDefaults.personalLoanRate} onChange={handleTenantDefaultChange} /></Field>
                            <Field label="Tasa negocio (%)"><input name="businessLoanRate" type="number" step="0.01" value={formData.tenantDefaults.businessLoanRate} onChange={handleTenantDefaultChange} /></Field>
                            <Field label="Tasa hipotecaria (%)"><input name="mortgageLoanRate" type="number" step="0.01" value={formData.tenantDefaults.mortgageLoanRate} onChange={handleTenantDefaultChange} /></Field>
                            <Field label="Tasa vehicular (%)"><input name="autoLoanRate" type="number" step="0.01" value={formData.tenantDefaults.autoLoanRate} onChange={handleTenantDefaultChange} /></Field>
                            <Field label="Penalidad mora (%)"><input name="latePenaltyRate" type="number" step="0.01" value={formData.tenantDefaults.latePenaltyRate} onChange={handleTenantDefaultChange} /></Field>
                            <Field label="Dias de gracia"><input name="graceDays" type="number" value={formData.tenantDefaults.graceDays} onChange={handleTenantDefaultChange} /></Field>
                            <Field label="Score autoaprobacion"><input name="autoApprovalScore" type="number" value={formData.tenantDefaults.autoApprovalScore} onChange={handleTenantDefaultChange} /></Field>
                            <Field label="Max deuda / ingreso (%)"><input name="maxDebtToIncome" type="number" step="0.01" value={formData.tenantDefaults.maxDebtToIncome} onChange={handleTenantDefaultChange} /></Field>
                            <Field label="Capital inicial"><input name="capitalBudget" type="number" step="0.01" value={formData.tenantDefaults.capitalBudget} onChange={handleTenantDefaultChange} /></Field>
                        </div>
                    </fieldset>

                    <fieldset className="form-section">
                        <h5 className="form-section-title">Modelo de riesgo de clientes</h5>
                        <p className="muted small">Estos pesos afectan el score de riesgo mostrado en el detalle de clientes para todos los tenants.</p>
                        <div className="form-grid cols-3">
                            <Field label="Score inicial"><input name="initialScore" type="number" step="0.01" value={formData.riskModel.initialScore} onChange={handleRiskModelChange} /></Field>
                            <Field label="Recompensa pago puntual"><input name="onTimePaymentReward" type="number" step="0.01" value={formData.riskModel.onTimePaymentReward} onChange={handleRiskModelChange} /></Field>
                            <Field label="Recompensa promesa cumplida"><input name="keptPromiseReward" type="number" step="0.01" value={formData.riskModel.keptPromiseReward} onChange={handleRiskModelChange} /></Field>
                            <Field label="Recompensa actividad de pago"><input name="paymentActivityReward" type="number" step="0.01" value={formData.riskModel.paymentActivityReward} onChange={handleRiskModelChange} /></Field>
                            <Field label="Tope actividad (pagos)"><input name="paymentActivityCap" type="number" step="1" value={formData.riskModel.paymentActivityCap} onChange={handleRiskModelChange} /></Field>
                            <Field label="Penalizacion pago tardio"><input name="latePaymentPenalty" type="number" step="0.01" value={formData.riskModel.latePaymentPenalty} onChange={handleRiskModelChange} /></Field>
                            <Field label="Penalizacion promesa incumplida"><input name="brokenPromisePenalty" type="number" step="0.01" value={formData.riskModel.brokenPromisePenalty} onChange={handleRiskModelChange} /></Field>
                            <Field label="Penalizacion promesa pendiente"><input name="pendingPromisePenalty" type="number" step="0.01" value={formData.riskModel.pendingPromisePenalty} onChange={handleRiskModelChange} /></Field>
                            <Field label="Penalizacion por dia en mora"><input name="overdueDayPenalty" type="number" step="0.01" value={formData.riskModel.overdueDayPenalty} onChange={handleRiskModelChange} /></Field>
                            <Field label="Tope mora maxima"><input name="overdueDayCap" type="number" step="0.01" value={formData.riskModel.overdueDayCap} onChange={handleRiskModelChange} /></Field>
                            <Field label="Penalizacion mora acumulada"><input name="overdueAccumulatedPenalty" type="number" step="0.01" value={formData.riskModel.overdueAccumulatedPenalty} onChange={handleRiskModelChange} /></Field>
                            <Field label="Tope mora acumulada"><input name="overdueAccumulatedCap" type="number" step="0.01" value={formData.riskModel.overdueAccumulatedCap} onChange={handleRiskModelChange} /></Field>
                            <Field label="Penalizacion cuotas en atraso"><input name="lagInstallmentPenalty" type="number" step="0.01" value={formData.riskModel.lagInstallmentPenalty} onChange={handleRiskModelChange} /></Field>
                            <Field label="Penalizacion sin pagos"><input name="noPaymentHistoryPenalty" type="number" step="0.01" value={formData.riskModel.noPaymentHistoryPenalty} onChange={handleRiskModelChange} /></Field>
                        </div>
                    </fieldset>
                </div>

                <aside className="card section-stack superadmin-side-panel">
                    <div className="section-head">
                        <h3>Impacto actual</h3>
                    </div>

                    <div className="superadmin-list">
                        <div className="superadmin-list-item stack-item">
                            <div>
                                <span className="muted small">Registro admin</span>
                                <strong>{payload.allowAdminRegistration ? 'Habilitado' : 'Bloqueado'}</strong>
                            </div>
                            <span className={`status ${payload.allowAdminRegistration ? 'status-active' : 'status-inactive'}`}>{payload.allowAdminRegistration ? 'Abierto' : 'Cerrado'}</span>
                        </div>
                        <div className="superadmin-list-item stack-item">
                            <div>
                                <span className="muted small">Nuevo tenant</span>
                                <strong>{payload.newTenantStatus === 'active' ? 'Entrara activo' : 'Entrara inactivo'}</strong>
                            </div>
                            <span className={`status status-${payload.newTenantStatus}`}>{payload.newTenantStatus === 'active' ? 'Activo' : 'Inactivo'}</span>
                        </div>
                        <div className="superadmin-list-item stack-item">
                            <div>
                                <span className="muted small">Soporte</span>
                                <strong>{payload.supportEmail || 'Sin correo definido'}</strong>
                            </div>
                        </div>
                        <div className="superadmin-list-item stack-item">
                            <div>
                                <span className="muted small">Modelo de riesgo</span>
                                <strong>Score inicial {payload.riskModel.initialScore} · Pago puntual +{payload.riskModel.onTimePaymentReward}</strong>
                                <p className="muted tiny">Promesa incumplida -{payload.riskModel.brokenPromisePenalty}</p>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar configuracion global'}
                    </button>
                </aside>
            </form>
        </section>
    );
}
