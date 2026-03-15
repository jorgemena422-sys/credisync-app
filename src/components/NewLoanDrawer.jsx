import React, { useState, useEffect } from 'react';
import Drawer from './Drawer';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

const LOAN_TYPES = {
  DIARY: { label: 'Diario', defaultRate: 20 },
  WEEKLY: { label: 'Semanal', defaultRate: 15 },
  BIWEEKLY: { label: 'Quincenal', defaultRate: 12 },
  MONTHLY: { label: 'Mensual', defaultRate: 10 }
};

const NewLoanDrawer = ({ isOpen, onClose }) => {
  const { customers, createLoan } = useApp();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isManualRate, setIsManualRate] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: '',
    amount: '',
    interest_rate: 20,
    term: 24,
    type: 'DIARY',
    start_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!isManualRate) {
      setFormData(prev => ({
        ...prev,
        interest_rate: LOAN_TYPES[prev.type].defaultRate
      }));
    }
  }, [formData.type, isManualRate]);

  const totalToPay = formData.amount ? parseFloat(formData.amount) * (1 + formData.interest_rate / 100) : 0;
  const installmentValue = formData.term ? totalToPay / parseInt(formData.term) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) return showToast('Seleccione un cliente', 'error');
    
    setLoading(true);
    try {
      await createLoan({
        ...formData,
        amount: parseFloat(formData.amount),
        interest_rate: parseFloat(formData.interest_rate),
        term: parseInt(formData.term)
      });
      showToast('Préstamo originado exitosamente', 'success');
      onClose();
      setFormData({
        customer_id: '',
        amount: '',
        interest_rate: 20,
        term: 24,
        type: 'DIARY',
        start_date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      showToast(error.message || 'Error al crear préstamo', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Nuevo Préstamo">
      <form onSubmit={handleSubmit} className="drawer-form">
        <div className="form-group">
          <label>Cliente*</label>
          <select
            required
            value={formData.customer_id}
            onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
          >
            <option value="">Seleccione un cliente</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Monto Principal*</label>
            <input
              type="number"
              required
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label>Tipo de Cobro*</label>
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
            >
              {Object.entries(LOAN_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Tasa de Interés (%)*</label>
            <div className="input-with-toggle">
              <input
                type="number"
                value={formData.interest_rate}
                onChange={e => {
                  setFormData({ ...formData, interest_rate: e.target.value });
                  setIsManualRate(true);
                }}
              />
              <button 
                type="button" 
                className={`toggle-btn ${!isManualRate ? 'active' : ''}`}
                onClick={() => setIsManualRate(false)}
              >
                Auto
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Cuotas*</label>
            <input
              type="number"
              required
              value={formData.term}
              onChange={e => setFormData({ ...formData, term: e.target.value })}
            />
          </div>
        </div>

        <div className="loan-preview card-glass">
          <div className="preview-item">
            <span>Total a Pagar:</span>
            <strong>${totalToPay.toFixed(2)}</strong>
          </div>
          <div className="preview-item">
            <span>Valor Cuota:</span>
            <strong>${installmentValue.toFixed(2)}</strong>
          </div>
        </div>

        <div className="drawer-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Procesando...' : 'Originat Préstamo'}
          </button>
        </div>
      </form>
    </Drawer>
  );
};

export default NewLoanDrawer;