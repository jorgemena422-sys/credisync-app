import React, { useEffect, useState } from 'react';
import Drawer from './Drawer';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../utils/api';
import { isStagingRuntimeTarget } from '../utils/runtimeTarget';
import { clearStagingDraft, readStagingDraft, saveStagingDraft } from '../utils/stagingDraft';

const CUSTOMER_DRAFT_KEY = 'credisync:staging:draft:new-customer';

const EMPTY_CUSTOMER_FORM = {
  name: '',
  email: '',
  phone: '',
  address: ''
};

const NewCustomerDrawer = ({ isOpen, onClose }) => {
  const { state, setState, bootstrapState } = useApp();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => ({ ...EMPTY_CUSTOMER_FORM }));
  const readOnly = String(state?.subscription?.status || '').toLowerCase() === 'suspended';

  useEffect(() => {
    if (!isOpen) return;
    const draft = readStagingDraft(CUSTOMER_DRAFT_KEY, EMPTY_CUSTOMER_FORM);
    setFormData(draft && typeof draft === 'object' ? { ...EMPTY_CUSTOMER_FORM, ...draft } : { ...EMPTY_CUSTOMER_FORM });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isStagingRuntimeTarget) return;
    saveStagingDraft(CUSTOMER_DRAFT_KEY, formData);
  }, [formData, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) {
      showToast('Tenant en modo solo lectura. Contacta al superadministrador para reactivar el plan.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/customers', {
        method: 'POST',
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        }
      });

      onClose();

      if (isStagingRuntimeTarget && response?.customer) {
        setState((prev) => ({
          ...prev,
          customers: [response.customer, ...(prev.customers || [])]
        }));
        bootstrapState({ silent: true }).catch(() => undefined);
      } else {
        bootstrapState().catch(() => undefined);
      }

      clearStagingDraft(CUSTOMER_DRAFT_KEY);
      showToast('Cliente creado exitosamente');
      setFormData({ ...EMPTY_CUSTOMER_FORM });
    } catch (error) {
      showToast(error.message || 'Error al crear cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Nuevo Cliente">
      <div className="drawer-form-shell">
        <section className="drawer-hero">
          <div className="drawer-hero-main">
            <p className="eyebrow">Nuevo perfil</p>
            <h2>{formData.name ? formData.name : 'Cliente'}</h2>
            <div className="loan-detail-meta-row">
              <span className="status status-active">Registro rapido</span>
              <span className="small muted">Completa datos de contacto</span>
            </div>
          </div>
        </section>

        <section className="drawer-panel drawer-section">
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group">
              <label>Nombre completo</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Juan Perez"
              />
            </div>

            <div className="form-group">
              <label>Correo electronico</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="juan@email.com"
              />
            </div>

            <div className="form-group">
              <label>Telefono</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 809 000 0000"
              />
            </div>

            <div className="form-group">
              <label>Direccion</label>
              <textarea
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="Direccion del domicilio o negocio"
              />
            </div>

            <div className="action-group-inline">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={loading || readOnly}>
                {loading ? 'Guardando...' : 'Crear cliente'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Drawer>
  );
};

export default NewCustomerDrawer;
