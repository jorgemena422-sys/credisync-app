import React, { useCallback, useState } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { money } from '../utils/helpers';
import { invalidateSuperadminResource, useSuperadminResource } from '../hooks/useSuperadminResource';

function normalizePlanForUpdate(plan, patch = {}) {
    return {
        ...plan,
        ...patch,
        features: {
            ...(plan.features || {}),
            ...(patch.features || {})
        },
        limits: {
            ...(plan.limits || {}),
            ...(patch.limits || {})
        }
    };
}

export default function SuperadminPlans() {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [newPlan, setNewPlan] = useState({
        code: '',
        name: '',
        description: '',
        priceMonthly: '0',
        currency: 'DOP',
        billingCycle: 'monthly'
    });

    const fetchPlans = useCallback(async () => {
        const response = await apiRequest('/superadmin/plans');
        return Array.isArray(response?.plans) ? response.plans : [];
    }, []);

    const plansResource = useSuperadminResource('superadmin:plans', fetchPlans, []);
    const plans = plansResource.data;
    const loading = plansResource.loading;
    const refreshing = plansResource.refreshing;

    const createPlan = async (event) => {
        event.preventDefault();
        try {
            setSaving(true);
            await apiRequest('/superadmin/plans', {
                method: 'POST',
                body: {
                    code: newPlan.code,
                    name: newPlan.name,
                    description: newPlan.description,
                    priceMonthly: Number(newPlan.priceMonthly || 0),
                    currency: newPlan.currency,
                    billingCycle: newPlan.billingCycle,
                    isActive: true,
                    features: {},
                    limits: {}
                }
            });
            showToast('Plan creado');
            setNewPlan({ code: '', name: '', description: '', priceMonthly: '0', currency: 'DOP', billingCycle: 'monthly' });
            invalidateSuperadminResource('superadmin:plans');
            await plansResource.refresh();
        } catch (error) {
            showToast(error.message || 'No se pudo crear el plan');
        } finally {
            setSaving(false);
        }
    };

    const togglePlan = async (plan) => {
        try {
            const updated = normalizePlanForUpdate(plan, { isActive: !plan.isActive });
            await apiRequest(`/superadmin/plans/${plan.id}`, {
                method: 'PUT',
                body: updated
            });
            showToast('Plan actualizado');
            invalidateSuperadminResource('superadmin:plans');
            await plansResource.refresh();
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar el plan');
        }
    };

    if (loading) {
        return <section className="view"><div className="empty-state"><span className="material-symbols-outlined">hourglass_top</span><h4>Cargando planes...</h4></div></section>;
    }

    return (
        <section className="view">
            <div className="card section-stack">
                <div className="section-head split">
                    <div>
                        <h3>Planes de suscripcion</h3>
                        <p className="muted">Administra catalogo y activacion de planes.</p>
                        {refreshing && <p className="muted small">Actualizando planes...</p>}
                    </div>
                </div>
            </div>

            <form className="card section-stack form-grid" onSubmit={createPlan}>
                <h4>Nuevo plan</h4>
                <div className="detail-grid">
                    <label className="form-group">Codigo<input value={newPlan.code} onChange={(e) => setNewPlan((prev) => ({ ...prev, code: e.target.value }))} required /></label>
                    <label className="form-group">Nombre<input value={newPlan.name} onChange={(e) => setNewPlan((prev) => ({ ...prev, name: e.target.value }))} required /></label>
                    <label className="form-group">Precio mensual<input type="number" step="0.01" value={newPlan.priceMonthly} onChange={(e) => setNewPlan((prev) => ({ ...prev, priceMonthly: e.target.value }))} required /></label>
                    <label className="form-group">Moneda<select value={newPlan.currency} onChange={(e) => setNewPlan((prev) => ({ ...prev, currency: e.target.value }))}><option value="DOP">DOP</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
                    <label className="form-group">Ciclo<select value={newPlan.billingCycle} onChange={(e) => setNewPlan((prev) => ({ ...prev, billingCycle: e.target.value }))}><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></label>
                    <label className="form-group" style={{ gridColumn: '1 / -1' }}>Descripcion<textarea value={newPlan.description} onChange={(e) => setNewPlan((prev) => ({ ...prev, description: e.target.value }))} /></label>
                </div>
                <div className="action-group-inline">
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear plan'}</button>
                </div>
            </form>

            <div className="card section-stack">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Plan</th>
                                <th>Precio</th>
                                <th>Ciclo</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.length > 0 ? plans.map((plan) => (
                                <tr key={plan.id}>
                                    <td data-label="Plan"><div className="cell-stack"><strong>{plan.name}</strong><span>{plan.code}</span></div></td>
                                    <td data-label="Precio">{money(plan.priceMonthly)}</td>
                                    <td data-label="Ciclo">{plan.billingCycle === 'yearly' ? 'Anual' : 'Mensual'}</td>
                                    <td data-label="Estado"><span className={`status ${plan.isActive ? 'status-active' : 'status-inactive'}`}>{plan.isActive ? 'Activo' : 'Inactivo'}</span></td>
                                    <td data-label="Acciones"><button type="button" className="action-link" onClick={() => togglePlan(plan)}>{plan.isActive ? 'Desactivar' : 'Activar'}</button></td>
                                </tr>
                            )) : (
                                <tr className="empty-row"><td colSpan="5"><div className="empty-state compact-empty-state"><h4>No hay planes</h4></div></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
