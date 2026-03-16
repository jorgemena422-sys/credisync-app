import React, { useState } from 'react';
import Drawer from './Drawer';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useApp } from '../context/AppContext';
import { isoToday, loanOutstanding, money } from '../utils/helpers';

export default function NewPaymentDrawer({ isOpen, onClose }) {
    const { showToast } = useToast();
    const { state, bootstrapState } = useApp();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        loanId: '',
        amount: '',
        method: 'transfer',
        date: isoToday()
    });

    const selectedLoan = state.loans.find(l => String(l.id) === String(formData.loanId));
    const outstanding = selectedLoan ? loanOutstanding(selectedLoan) : 0;
    const selectedCustomer = selectedLoan ? state.customers.find(c => c.id === selectedLoan.customerId) : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.loanId || !formData.amount) {
            showToast('Selecciona un prestamo y especifica el monto');
            return;
        }

        try {
            setLoading(true);
            await apiRequest('/payments', {
                method: 'POST',
                body: {
                    ...formData,
                    amount: parseFloat(formData.amount),
                }
            });
            showToast('Pago registrado exitosamente');
            setFormData({ loanId: '', amount: '', method: 'transfer', date: isoToday() });
            await bootstrapState();
            onClose();
        } catch (err) {
            showToast(err.message || 'Error registrando el pago');
        } finally {
            setLoading(false);
        }
    };

    const handleSetMax = () => {
        if (selectedLoan && outstanding > 0) {
            setFormData({ ...formData, amount: outstanding.toFixed(2) });
        }
    };

    const activeLoans = state.loans.filter(l => l.status === 'active' || l.status === 'overdue');

    return (
        <Drawer isOpen={isOpen} onClose={onClose} title="Registrar Pago">
            <div className="drawer-form-shell">
                <section className="drawer-hero">
                    <div className="drawer-hero-main">
                        <p className="eyebrow">Monto aplicado</p>
                        <h2>{formData.amount ? money(Number(formData.amount)) : money(0)}</h2>
                        <div className="loan-detail-meta-row">
                            <span className="status status-pending">{selectedLoan ? `Prestamo ${selectedLoan.id}` : 'Selecciona un prestamo'}</span>
                            <span className="small muted">{selectedCustomer ? selectedCustomer.name : 'Cliente pendiente'}</span>
                        </div>
                    </div>
                </section>
                <section className="drawer-panel drawer-section">
                    <form onSubmit={handleSubmit} className="form-grid">
                        <div className="form-group">
                            <label>Seleccionar Prestamo</label>
                            <select
                                required
                                value={formData.loanId}
                                onChange={e => {
                                    setFormData({ ...formData, loanId: e.target.value, amount: '' });
                                }}
                            >
                                <option value="" disabled>Selecciona un prestamo activo</option>
                                {activeLoans.map(l => {
                                    const customer = state.customers.find(c => c.id === l.customerId);
                                    return (
                                        <option key={l.id} value={l.id}>
                                            ID: {l.id} - {customer ? customer.name : 'Desc.'} - Saldo: {money(loanOutstanding(l))}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Monto a pagar ($)</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="number"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    max={outstanding > 0 ? outstanding : undefined}
                                    placeholder="Ej. 1500"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={handleSetMax}
                                    disabled={!selectedLoan || outstanding <= 0}
                                    title="Liquidar saldo"
                                >
                                    Liquidar
                                </button>
                            </div>
                            {selectedLoan && (
                                <small className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                                    Saldo actual: {money(outstanding)}
                                </small>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Metodo de pago</label>
                            <select
                                required
                                value={formData.method}
                                onChange={e => setFormData({ ...formData, method: e.target.value })}
                            >
                                <option value="transfer">Transferencia</option>
                                <option value="cash">Efectivo</option>
                                <option value="card">Tarjeta</option>
                                <option value="check">Cheque</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Fecha de pago</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>

                        <div className="form-group" style={{ marginTop: '0.35rem' }}>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Procesando...' : 'Registrar Pago'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </Drawer>
    );
}
