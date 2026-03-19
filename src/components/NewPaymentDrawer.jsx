import React, { useState } from 'react';
import Drawer from './Drawer';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useApp } from '../context/AppContext';
import { isoToday, loanInstallment, loanLateFeeOutstanding, loanOutstanding, loanOutstandingWithPenalty, money, round2 } from '../utils/helpers';

export default function NewPaymentDrawer({ isOpen, onClose }) {
    const { showToast } = useToast();
    const { state, bootstrapState } = useApp();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        loanId: '',
        baseAmount: '',
        lateFeeAmount: '',
        generateReceiptPdf: true,
        method: 'transfer',
        date: isoToday()
    });

    const selectedLoan = state.loans.find(l => String(l.id) === String(formData.loanId));
    const baseOutstanding = selectedLoan ? loanOutstanding(selectedLoan) : 0;
    const lateFeeOutstanding = selectedLoan ? loanLateFeeOutstanding(selectedLoan, state) : 0;
    const outstanding = selectedLoan ? loanOutstandingWithPenalty(selectedLoan, state) : 0;
    const selectedCustomer = selectedLoan ? state.customers.find(c => c.id === selectedLoan.customerId) : null;
    const installment = selectedLoan ? loanInstallment(selectedLoan) : 0;

    const rawBaseAmount = Number(formData.baseAmount || 0);
    const rawLateFeeAmount = Number(formData.lateFeeAmount || 0);
    const baseAmount = Number.isFinite(rawBaseAmount) ? Math.max(rawBaseAmount, 0) : 0;
    const lateFeeAmount = Number.isFinite(rawLateFeeAmount) ? Math.max(rawLateFeeAmount, 0) : 0;
    const totalAmount = round2(baseAmount + lateFeeAmount);

    const dueInstallmentBase = (() => {
        if (!selectedLoan || installment <= 0 || baseOutstanding <= 0) return 0;
        const paidAmount = Number(selectedLoan.paidAmount || 0);
        const paidInstallments = Math.floor((paidAmount + 0.00001) / installment);
        const paidInCurrentInstallment = Math.max(round2(paidAmount - (paidInstallments * installment)), 0);
        const remainingCurrentInstallment = round2(Math.max(installment - paidInCurrentInstallment, 0));
        const currentDue = remainingCurrentInstallment <= 0.01 ? installment : remainingCurrentInstallment;
        return round2(Math.min(currentDue, baseOutstanding));
    })();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.loanId || totalAmount <= 0) {
            showToast('Selecciona un prestamo y especifica cuota o mora');
            return;
        }

        try {
            setLoading(true);
            const response = await apiRequest('/payments', {
                method: 'POST',
                body: {
                    loanId: formData.loanId,
                    method: formData.method,
                    date: formData.date,
                    amount: totalAmount,
                    baseAmount: round2(baseAmount),
                    lateFeeAmount: round2(lateFeeAmount)
                }
            });

            const paymentId = String(response?.payment?.id || '').trim();
            const lateFeeApplied = Number(response?.allocation?.lateFeeApplied || 0);
            const baseApplied = Number(response?.allocation?.baseApplied || 0);

            if (lateFeeApplied > 0) {
                showToast(`Pago registrado. ${money(baseApplied)} al prestamo y ${money(lateFeeApplied)} a mora.`);
            } else {
                showToast('Pago registrado exitosamente');
            }

            if (paymentId && formData.generateReceiptPdf) {
                try {
                    const receiptResponse = await fetch(`/api/payments/${encodeURIComponent(paymentId)}/receipt.pdf`, {
                        method: 'GET',
                        credentials: 'include'
                    });

                    if (!receiptResponse.ok) {
                        let message = `No se pudo generar el comprobante (${receiptResponse.status})`;
                        try {
                            const payload = await receiptResponse.json();
                            if (payload?.message) message = payload.message;
                        } catch (_error) {
                            // ignore JSON parsing errors
                        }
                        throw new Error(message);
                    }

                    const blob = await receiptResponse.blob();
                    const downloadUrl = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = downloadUrl;
                    anchor.download = `comprobante-${paymentId}.pdf`;
                    document.body.appendChild(anchor);
                    anchor.click();
                    anchor.remove();
                    URL.revokeObjectURL(downloadUrl);
                } catch (receiptError) {
                    showToast(receiptError.message || 'Pago registrado, pero fallo la descarga del comprobante');
                }
            }

            setFormData({
                loanId: '',
                baseAmount: '',
                lateFeeAmount: '',
                generateReceiptPdf: true,
                method: 'transfer',
                date: isoToday()
            });
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
            setFormData({
                ...formData,
                baseAmount: baseOutstanding > 0 ? baseOutstanding.toFixed(2) : '',
                lateFeeAmount: lateFeeOutstanding > 0 ? lateFeeOutstanding.toFixed(2) : ''
            });
        }
    };

    const handleSetInstallmentOnly = () => {
        if (selectedLoan && dueInstallmentBase > 0) {
            setFormData({
                ...formData,
                baseAmount: dueInstallmentBase.toFixed(2)
            });
        }
    };

    const handleSetLateFeeOnly = () => {
        if (selectedLoan && lateFeeOutstanding > 0) {
            setFormData({
                ...formData,
                lateFeeAmount: lateFeeOutstanding.toFixed(2)
            });
        }
    };

    const activeLoans = state.loans.filter(l => l.status === 'active' || l.status === 'overdue');

    return (
        <Drawer isOpen={isOpen} onClose={onClose} title="Registrar Pago">
            <div className="drawer-form-shell">
                <section className="drawer-hero">
                    <div className="drawer-hero-main">
                        <p className="eyebrow">Monto aplicado</p>
                        <h2>{money(totalAmount)}</h2>
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
                                    setFormData({ ...formData, loanId: e.target.value, baseAmount: '', lateFeeAmount: '' });
                                }}
                            >
                                <option value="" disabled>Selecciona un prestamo activo</option>
                                {activeLoans.map(l => {
                                    const customer = state.customers.find(c => c.id === l.customerId);
                                    return (
                                        <option key={l.id} value={l.id}>
                                            ID: {l.id} - {customer ? customer.name : 'Desc.'} - Saldo: {money(loanOutstandingWithPenalty(l, state))}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Cuota / base a pagar ($)</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    max={baseOutstanding > 0 ? baseOutstanding : undefined}
                                    placeholder="Ej. 4000"
                                    value={formData.baseAmount}
                                    onChange={e => setFormData({ ...formData, baseAmount: e.target.value })}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={handleSetInstallmentOnly}
                                    disabled={!selectedLoan || dueInstallmentBase <= 0}
                                    title="Pagar cuota vencida"
                                >
                                    Cuota
                                </button>
                            </div>
                            <small className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                                Cuota vencida estimada: {money(dueInstallmentBase)}
                            </small>
                        </div>

                        <div className="form-group">
                            <label>Mora a pagar ($)</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    max={lateFeeOutstanding > 0 ? lateFeeOutstanding : undefined}
                                    placeholder="Ej. 350"
                                    value={formData.lateFeeAmount}
                                    onChange={e => setFormData({ ...formData, lateFeeAmount: e.target.value })}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={handleSetLateFeeOnly}
                                    disabled={!selectedLoan || lateFeeOutstanding <= 0}
                                    title="Pagar mora pendiente"
                                >
                                    Mora
                                </button>
                            </div>
                            {selectedLoan && (
                                <div className="cell-stack" style={{ marginTop: '0.25rem' }}>
                                    <small className="muted">Saldo total: {money(outstanding)}</small>
                                    {lateFeeOutstanding > 0 && <small className="muted">Mora acumulada: {money(lateFeeOutstanding)}</small>}
                                    <small className="muted">Saldo base: {money(baseOutstanding)}</small>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={handleSetMax}
                                    disabled={!selectedLoan || outstanding <= 0}
                                >
                                    Liquidar todo
                                </button>
                            </div>
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

                        <div className="form-group payment-receipt-group" style={{ marginTop: '0.35rem' }}>
                            <label>Comprobante</label>
                            <div className="payment-receipt-card" aria-live="polite">
                                <div className="payment-receipt-icon">
                                    <span className="material-symbols-outlined">picture_as_pdf</span>
                                </div>
                                <div className="payment-receipt-copy cell-stack">
                                    <strong>Comprobante de pago PDF</strong>
                                    <span className="muted small">Se descargara automaticamente al registrar el pago.</span>
                                </div>
                                <span className="status status-active">Activo</span>
                            </div>
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
