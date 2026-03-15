import React, { useState } from 'react';
import Drawer from './Drawer';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

const NewCustomerDrawer = ({ isOpen, onClose }) => {
  const { createCustomer } = useApp();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createCustomer(formData);
      showToast('Cliente creado exitosamente', 'success');
      onClose();
      setFormData({ name: '', email: '', phone: '', address: '' });
    } catch (error) {
      showToast(error.message || 'Error al crear cliente', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Nuevo Cliente">
      <form onSubmit={handleSubmit} className="drawer-form">
        <div className="form-group">
          <label>Nombre Completo*</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Juan Pérez"
          />
        </div>
        <div className="form-group">
          <label>Correo Electrónico</label>
          <input
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            placeholder="juan@email.com"
          />
        </div>
        <div className="form-group">
          <label>Teléfono*</label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+51 987 654 321"
          />
        </div>
        <div className="form-group">
          <label>Dirección</label>
          <textarea
            value={formData.address}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
            placeholder="Dirección del domicilio o negocio"
          />
        </div>
        <div className="drawer-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear Cliente'}
          </button>
        </div>
      </form>
    </Drawer>
  );
};

export default NewCustomerDrawer;