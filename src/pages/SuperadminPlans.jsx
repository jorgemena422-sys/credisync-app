import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { money } from '../utils/helpers';

function emptyForm() {
    return {
        id: '',
        code: '',
        name: '',
        description: '',
        priceMonthly: 0,
        currency: 'USD',
        billingCycle: 'monthly',
        isActive: true,
        features: {
            calendarIcsEnabled: true,
            advancedReportsEnabled: true,
            exportsEnabled: false,
            brandingEnabled: false,
            prioritySupport: false
        },
        limits: {
            maxUsers: 1,
            maxCustomers: 100,
            maxActiveLoans: 150
        }
    };
}

export default function SuperadminPlans() {
    const { showToast } = useToast();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(emptyForm());

    const loadPlans = async () => {
        try {
            setLoading(true);
            const response = await apiRequest('/superadmin/plans');
            const incoming = Array.isArray(response?.plans) ? response.plans : [];
            setPlans(incoming);
            if (incoming.length > 0 && !form.id) {
                setForm({ ...emptyForm(), ...incoming[0], features: { ...emptyForm().features, ...(incoming[0].features || {}) }, limits: { ...emptyForm().limits, ...(incoming[0].limits || {}) } });
            }
        } catch (error) {
            showToast(error.message || 'No fue posible cargar los planes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, []);

    const selectedPlan = useMemo(() => plans.find((plan) => plan.id === form.id) || null, [plans, form.id]);

    const setFeature = (key, value) => {
        setForm((prev) => ({
            ...prev,
            features: {
                ...prev.features,
                [key]: value
            }
        }));
    };

    const setLimit = (key, value) => {
        setForm((prev) => ({
            ...prev,
            limits: {
                ...prev.limits,
                [key]: value
            }
        }));
    };

    const submitForm = async (event) => {
        event.preventDefault();
        try {
            setSaving(true);
            const payload = {
                code: String(form.code || '').trim().toLowerCase(),
                name: String(form.name || '').trim(),
                description: String(form.description || '').trim(),
                priceMonthly: Number(form.priceMonthly) || 0,
                currency: String(form.currency || 'USD').trim().toUpperCase(),
                billingCycle: String(form.billingCycle || 'monthly').trim().toLowerCase(),
                isActive: Boolean(form.isActive),
                features: {
                    calendarIcsEnabled: Boolean(form.features.calendarIcsEnabled),
                    advancedReportsEnabled: Boolean(form.features.advancedReportsEnabled),
                    exportsEnabled: Boolean(form.features.exportsEnabled),
                    brandingEnabled: Boolean(form.features.brandingEnabled),
                    prioritySupport: Boolean(form.features.prioritySupport)
                },
                limits: {
                    maxUsers: Number(form.limits.maxUsers) || 1,
                    maxCustomers: Number(form.limits.maxCustomers) || 1,
                    maxActiveLoans: Number(form.limits.maxActiveLoans) || 1
                }
            };

            if (form.id) {
                await apiRequest(`/superadmin/plans/${form.id}`, { method: 'PUT', body: payload });
                showToast('Plan actualizado');
            } else {
                await apiRequest('/superadmin/plans', { method: 'POST', body: payload });
                showToast('Plan creado');
            }

            await loadPlans();
        } catch (error) {
            showToast(error.message || 'No fue posible guardar el plan');
        } finally {
            setSaving(false);
        }
    };

    const startNew = () => {
        setForm(emptyForm());
    };

    return (
        <section className="view">
            <div className="card section-stack superadmin-head">
                <div className="section-head split">
                    <div>
                        <h3>Planes de suscripcion</h3>
                        <p className="muted">Define precios, beneficios y limites por plan para cada tenant.</p>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={startNew}>Nuevo plan</button>
                </div>
            </div>

            <div className="superadmin-layout">
                <div className="card section-stack superadmin-main-panel">
                    <div className="section-head split">
                        <h3>Catalogo de planes</h3>
                        <span className="muted small">{plans.length} plan(es)</span>
                    </div>
                    {loading ? (
                        <div className="empty-state compact-empty-state"><h4>Cargando planes...</h4></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Plan</th>
                                        <th>Precio</th>
                                        <th>Estado</th>
                                        <th>Beneficios</th>
                                        <th>Limites</th>
                                        <th>Accion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plans.length > 0 ? plans.map((plan) => (
                                        <tr key={plan.id} className={selectedPlan?.id === plan.id ? 'superadmin-row-active' : ''}>
                                            <td data-label="Plan">
                                                <div className="cell-stack">
                                                    <strong>{plan.name}</strong>
                                                    <span className="muted small">{plan.code}</span>
                                                </div>
                                            </td>
                                            <td data-label="Precio">{money(plan.priceMonthly)}</td>
                                            <td data-label="Estado"><span className={`status ${plan.isActive ? 'status-active' : 'status-inactive'}`}>{plan.isActive ? 'Activo' : 'Inactivo'}</span></td>
                                            <td data-label="Beneficios">
                                                <span className="muted small">ICS {plan.features?.calendarIcsEnabled ? 'Si' : 'No'} · Reportes {plan.features?.advancedReportsEnabled ? 'Si' : 'No'}</span>
                                            </td>
                                            <td data-label="Limites">
                                                <span className="muted small">Users {plan.limits?.maxUsers} · Clientes {plan.limits?.maxCustomers}</span>
                                            </td>
                                            <td data-label="Accion">
                                                <button
                                                    type="button"
                                                    className="action-link"
                                                    onClick={() => setForm({ ...emptyForm(), ...plan, features: { ...emptyForm().features, ...(plan.features || {}) }, limits: { ...emptyForm().limits, ...(plan.limits || {}) } })}
                                                >
                                                    Editar
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr className="empty-row"><td colSpan="6"><div className="empty-state compact-empty-state"><h4>No hay planes</h4></div></td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <aside className="card section-stack superadmin-side-panel">
                    <div className="section-head">
                        <h3>{form.id ? 'Editar plan' : 'Nuevo plan'}</h3>
                    </div>
                    <form className="form-section" onSubmit={submitForm}>
                        <label>Codigo</label>
                        <input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="starter" required />

                        <label>Nombre</label>
                        <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />

                        <label>Descripcion</label>
                        <textarea value={form.description || ''} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} />

                        <label>Precio mensual (USD)</label>
                        <input type="number" step="0.01" min="0" value={form.priceMonthly} onChange={(event) => setForm((prev) => ({ ...prev, priceMonthly: event.target.value }))} required />

                        <label>Estado</label>
                        <select value={form.isActive ? 'active' : 'inactive'} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.value === 'active' }))}>
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                        </select>

                        <label className="superadmin-toggle-row"><input type="checkbox" checked={Boolean(form.features.calendarIcsEnabled)} onChange={(event) => setFeature('calendarIcsEnabled', event.target.checked)} /><div><strong>Incluir calendario ICS</strong></div></label>
                        <label className="superadmin-toggle-row"><input type="checkbox" checked={Boolean(form.features.advancedReportsEnabled)} onChange={(event) => setFeature('advancedReportsEnabled', event.target.checked)} /><div><strong>Reportes avanzados</strong></div></label>
                        <label className="superadmin-toggle-row"><input type="checkbox" checked={Boolean(form.features.exportsEnabled)} onChange={(event) => setFeature('exportsEnabled', event.target.checked)} /><div><strong>Exportaciones</strong></div></label>

                        <label>Maximo de usuarios</label>
                        <input type="number" min="1" value={form.limits.maxUsers} onChange={(event) => setLimit('maxUsers', event.target.value)} required />

                        <label>Maximo de clientes</label>
                        <input type="number" min="1" value={form.limits.maxCustomers} onChange={(event) => setLimit('maxCustomers', event.target.value)} required />

                        <label>Maximo de prestamos activos</label>
                        <input type="number" min="1" value={form.limits.maxActiveLoans} onChange={(event) => setLimit('maxActiveLoans', event.target.value)} required />

                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : form.id ? 'Actualizar plan' : 'Crear plan'}
                        </button>
                    </form>
                </aside>
            </div>
        </section>
    );
}
