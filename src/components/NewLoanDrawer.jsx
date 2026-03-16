import React, { useState, useEffect, useRef } from 'react';
import Drawer from './Drawer';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useApp } from '../context/AppContext';
import { isoToday, capitalAvailable, money } from '../utils/helpers';

function getRateForLoanType(settings, loanType) {
    const rateMap = {
        personal: settings?.personalLoanRate,
        business: settings?.businessLoanRate,
        mortgage: settings?.mortgageLoanRate,
        auto: settings?.autoLoanRate
    };
    const specificRate = rateMap[loanType];
    if (specificRate !== undefined && specificRate !== null && specificRate > 0) {
        return specificRate;
    }
    const defaultRates = {
        personal: 12,
        business: 15,
        mortgage: 10,
        auto: 14
    };
    return defaultRates[loanType] || 12;
}

export default function NewLoanDrawer({ isOpen, onClose }) {
    const { showToast } = useToast();
    const { state, bootstrapState } = useApp();
    const [loading, setLoading] = useState(false);
    const rateManuallyEdited = useRef(false);

    const availableCapital = capitalAvailable(state);
    const currentRate = getRateForLoanType(state.settings, 'personal');

    const [formData, setFormData] = useState({
        customerId: '',
        principal: '',
        interestRate: currentRate,
        interestRateMode: 'annual',
        termMonths: '',
        startDate: isoToday(),
        type: 'personal'
    });

    const selectedCustomer = state.customers.find(customer => String(customer.id) === String(formData.customerId));

    // Reset manual edit flag when drawer opens
    useEffect(() => {
        if (isOpen) {
            rateManuallyEdited.current = false;
        }
    }, [isOpen]);

    // Auto-fill rate when loan type changes — but NOT if the user manually edited it
    useEffect(() => {
        if (rateManuallyEdited.current) return;
        const newRate = getRateForLoanType(state.settings, formData.type);
        setFormData(prev => {
            if (prev.interestRate !== newRate) {
                return { ...prev, interestRate: newRate };
            }
            return prev;
        });
    }, [state.settings, formData.type]);

    const handleRateChange = (e) => {
        rateManuallyEdited.current = true;
        setFormData({ ...formData, interestRate: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customerId || !formData.principal || !formData.termMonths) {
            showToast('Completa los campos requeridos');
            return;
        }

        try {
            setLoading(true);
            await apiRequest('/loans', {
                method: 'POST',
                body: {
                    ...formData,
                    principal: parseFloat(formData.principal),
                    interestRate: parseFloat(formData.interestRate),
                    termMonths: parseInt(formData.termMonths, 10),
                }
            });
            showToast('Prestamo creado exitosamente');
            const resetRate = getRateForLoanType(state.settings, 'personal');
            rateManuallyEdited.current = false;
            setFormData({
                customerId: '', principal: '', interestRate: resetRate, interestRateMode: 'annual', termMonths: '', startDate: isoToday(), type: 'personal'
            });
            await bootstrapState();
            onClose();
        } catch (err) {
            showToast(err.message || 'Error originando prestamo');
        } finally {
            setLoading(false);
        }
    };

    const rateLabel = formData.interestRateMode === 'monthly' ? 'mensual' : 'anual';
    const typeLabel = formData.type === 'personal' ? 'préstamo personal' : formData.type === 'business' ? 'negocio' : formData.type === 'mortgage' ? 'hipotecario' : 'vehicular';

    return (
        <Drawer isOpen={isOpen} onClose={onClose} title="Originar Prestamo">
            <div className="drawer-form-shell">
                <section className="drawer-hero">
                    <div className="drawer-hero-main">
                        <p className="eyebrow">Exposicion proyectada</p>
                        <h2>{formData.principal ? money(Number(formData.principal)) : money(0)}</h2>
                        <div className="loan-detail-meta-row">
                            <span className="status status-active">{selectedCustomer ? selectedCustomer.name : 'Cliente pendiente'}</span>
                            <span className="small muted">{formData.termMonths ? `${formData.termMonths} mes(es)` : 'Define el plazo del credito'}</span>
                        </div>
                    </div>
                </section>
                <section className="drawer-panel drawer-section">
                    <form onSubmit={handleSubmit} className="form-grid">
                        <div className="form-group">
                            <label>Cliente</label>
                            <select
                                required
                                value={formData.customerId}
                                onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                            >
                                <option value="" disabled>Selecciona un cliente</option>
                                {state.customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Monto a prestar ($)</label>
                            <input
                                type="number"
                                required
                                min="1"
                                step="0.01"
                                placeholder="Ej. 10000"
                                value={formData.principal}
                                onChange={e => setFormData({ ...formData, principal: e.target.value })}
                            />
                            {availableCapital > 0 && (
                                <small className="muted" style={{ display: 'block', marginTop: '0.25rem', color: '#79e0af' }}>
                                    Capital disponible: {money(availableCapital)}
                                </small>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Plazo (Meses)</label>
                            <input
                                type="number"
                                required
                                min="1"
                                placeholder="Ej. 12"
                                value={formData.termMonths}
                                onChange={e => setFormData({ ...formData, termMonths: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label>Tipo de prestamo</label>
                            <select
                                required
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="personal">Personal</option>
                                <option value="business">Negocio</option>
                                <option value="mortgage">Hipotecario</option>
                                <option value="auto">Vehicular</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Tipo de tasa</label>
                            <select
                                value={formData.interestRateMode}
                                onChange={e => setFormData({ ...formData, interestRateMode: e.target.value })}
                            >
                                <option value="annual">Anual</option>
                                <option value="monthly">Mensual</option>
                            </select>
                            <small className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                                {formData.interestRateMode === 'monthly'
                                    ? 'El % se aplica por cada mes del plazo'
                                    : 'El % se prorratea sobre los meses del plazo'}
                            </small>
                        </div>

                        <div className="form-group">
                            <label>Tasa de interés {rateLabel} (%)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={formData.interestRate}
                                onChange={handleRateChange}
                            />
                            <small className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                                {rateManuallyEdited.current
                                    ? 'Tasa personalizada para este prestamo'
                                    : `Tasa predeterminada para ${typeLabel}`}
                            </small>
                        </div>

                        <div className="form-group">
                            <label>Fecha de inicio</label>
                            <input
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>

                        <div className="form-group" style={{ marginTop: '0.35rem' }}>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Procesando...' : 'Crear Prestamo'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </Drawer>
    );
}
