import React, { useState } from 'react';
import Drawer from './Drawer';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useApp } from '../context/AppContext';

export default function NewCustomerDrawer({ isOpen, onClose }) {
    const { showToast } = useToast();
    const { bootstrapState } = useApp();
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
    const [loading, setLoading] = useState(false);

    const hasContactData = Boolean(formData.email || formData.phone);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) {
            showToast('Name is required');
            return;
        }

        try {
            setLoading(true);
            await apiRequest('/customers', {
                method: 'POST',
                body: formData
            });
            showToast('Cliente creado exitosamente');
            setFormData({ name: '', email: '', phone: '', address: '' });
            await bootstrapState();
            onClose();
        } catch (err) {
            showToast(err.message || 'Error creando cliente');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Drawer isOpen={isOpen} onClose={onClose} title="Nuevo Cliente">
            <div className="drawer-form-shell">
                <section className="drawer-hero">
                    <div className="drawer-hero-main">
                        <p className="eyebrow">Alta de cliente</p>
                        <h2>{formData.name || 'Perfil nuevo'}</h2>
                        <div className="loan-detail-meta-row">
                            <span className="status status-active">Registro manual</span>
                            <span className="small muted">Listo para asociar prestamos y pagos</span>
                        </div>
                    </div>

                    <div className="drawer-panel drawer-hero-side">
                        <div className="drawer-section-head split">
                            <h4>Contacto</h4>
                            <span className="muted small">Vista previa</span>
                        </div>
                        <div className="drawer-highlight-list">
                            <div className="drawer-highlight-item">
                                <div>
                                    <span className="muted small">Correo</span>
                                    <strong>{formData.email || 'Pendiente de registrar'}</strong>
                                </div>
                            </div>
                            <div className="drawer-highlight-item">
                                <div>
                                    <span className="muted small">Telefono</span>
                                    <strong>{formData.phone || 'Sin numero agregado'}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="drawer-panel drawer-section">
                    <div className="drawer-section-head">
                        <div>
                            <h4>Informacion del cliente</h4>
                            <p className="muted">Captura los datos base antes de originar su primer prestamo.</p>
                        </div>
                    </div>

                    <div className="drawer-section-grid">
                        <div className="drawer-stat">
                            <p className="muted small">Estado del perfil</p>
                            <strong>{formData.name ? 'Completo' : 'Borrador'}</strong>
                            <small className="muted">{hasContactData ? 'Ya tiene canales de contacto' : 'Falta agregar medios de contacto'}</small>
                        </div>
                        <div className="drawer-stat">
                            <p className="muted small">Direccion</p>
                            <strong>{formData.address ? 'Registrada' : 'Opcional'}</strong>
                            <small className="muted">Puedes agregarla ahora o despues.</small>
                        </div>
                    </div>
                </section>

                <section className="drawer-panel drawer-section">
                    <form onSubmit={handleSubmit} className="form-grid">
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Nombre completo</label>
                            <input
                                type="text"
                                required
                                placeholder="Ej. Juan Perez"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Correo electronico</label>
                            <input
                                type="email"
                                placeholder="juan@email.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Telefono</label>
                            <input
                                type="tel"
                                placeholder="555-1234"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Direccion (Opcional)</label>
                            <input
                                type="text"
                                placeholder="Calle Falsa 123"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '0.35rem' }}>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar Cliente'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </Drawer>
    );
}
