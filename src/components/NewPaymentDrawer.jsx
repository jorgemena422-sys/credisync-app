import React, { useState, useEffect } from 'react';
import Drawer from './Drawer';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { formatMoney } from '../utils/helpers';

const NewPaymentDrawer = ({ isOpen, onClose, initialLoanId }) => {
  const { loans, activeLoans, createPayment } = useApp();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    loan_id: initialLoanId || '',
    amount: '',
    method: 'CASH',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (initialLoanId) setFormData(prev => ({ ...prev, loan_id: initialLoanId }));
  }, [initialLoanId]);

  const selectedLoan = activeLoans.find(l => l.id === formData.loan_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.loan_id) return showToast('Seleccione un préstamo', 'error');
    
    setLoading(true);
    try {
      await createPayment({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      showToast('Pago registrado correctamente', 'success');
      onClose();
      setFormData({
        loan_id: '',
        amount: '',
        method: 'CASH',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      showToast(error.message || 'Error al registrar pago', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Registrar Pago">
      <form onSubmit={handleSubmit} className="drawer-form">
        <div className="form-group">
          <label>Préstamo*</label>
          <select
            required
            value={formData.loan_id}
            onChange={e => setFormData({ ...formData, loan_id: e.target.value })}
          >
            <option value="">Seleccione un préstamo activo</option>
            {activeLoans.map(l => (
              <option key={l.id} value={l.id}>
                {l.customer_name} - {formatMoney(l.outstanding_balance)} pendiente
              </option>
            ))}
          </select>
        </div>

        {selectedLoan && (
          <div className="payment-summary card-glass mb-4">
            <div className="summary-row">
              <span>Saldo Pendiente:</span>
              <span className="text-ruby font-bold">{formatMoney(selectedLoan.outstanding_balance)}</span>
            </div>
            <div className="summary-row">
              <span>Valor Cuota:</span>
              <span>{formatMoney(selectedLoan.installment_value)}</span>
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Monto del Pago*</label>
          <div className="input-with-preset">
            <input
              type="number"
              required
              step="0.01"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
            />
            {selectedLoan && (
              <button 
                type="button" 
                className="preset-btn"
                onClick={() => setFormData({ ...formData, amount: selectedLoan.outstanding_balance })}
              >
                Liquidación
              </button>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Método de Pago*</label>
          <select
            value={formData.method}
            onChange={e => setFormData({ ...formData, method: e.target.value })}
          >
            <option value="CASH">Efectivo</option>
            <option value="TRANSFER">Transferencia</option>
            <option value="CARD">Tarjeta</option>
          </select>
        </div>

        <div className="form-group">
          <label>Fecha de Pago*</label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={e => setFormData({ ...formData, date: e.target.value })}
          />
        </div>

        <div className="drawer-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Confirmar Pago'}
          </button>
        </div>
      </form>
    </Drawer>
  );
};

export default NewPaymentDrawer;