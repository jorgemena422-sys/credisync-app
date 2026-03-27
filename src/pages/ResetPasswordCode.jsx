import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function ResetPasswordCode() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showToast } = useToast();

    const defaultEmail = useMemo(() => String(searchParams.get('email') || '').trim(), [searchParams]);
    const defaultCode = useMemo(() => String(searchParams.get('code') || '').trim(), [searchParams]);

    const [formData, setFormData] = useState({
        email: defaultEmail,
        code: defaultCode,
        password: '',
        confirmPassword: ''
    });
    const [submitting, setSubmitting] = useState(false);

    const setField = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const email = String(formData.email || '').trim().toLowerCase();
        const code = String(formData.code || '').trim();
        const password = String(formData.password || '');
        const confirmPassword = String(formData.confirmPassword || '');

        if (!email || !code || !password || !confirmPassword) {
            showToast('Completa todos los campos');
            return;
        }

        if (password.length < 8) {
            showToast('La nueva contrasena debe tener al menos 8 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            showToast('Las contrasenas no coinciden');
            return;
        }

        try {
            setSubmitting(true);
            await apiRequest('/auth/reset-password', {
                method: 'POST',
                body: {
                    email,
                    code,
                    password
                }
            });

            showToast('Contrasena actualizada. Inicia sesion con tu nueva clave.');
            navigate('/login', { replace: true });
        } catch (error) {
            showToast(error.message || 'No se pudo restablecer la contrasena');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <header className="auth-header">
                    <div className="auth-icon">
                        <span className="material-symbols-outlined">lock_reset</span>
                    </div>
                    <h1>Restablecer contrasena</h1>
                    <p>Introduce el codigo de 6 digitos y define tu nueva clave.</p>
                </header>

                <form onSubmit={handleSubmit} className="form-grid">
                    <label className="auth-field">
                        Correo electronico
                        <div className="input-row">
                            <span className="material-symbols-outlined">mail</span>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(event) => setField('email', event.target.value)}
                                placeholder="tu-correo@dominio.com"
                            />
                        </div>
                    </label>

                    <label className="auth-field">
                        Codigo de recuperacion
                        <div className="input-row">
                            <span className="material-symbols-outlined">pin</span>
                            <input
                                type="text"
                                required
                                value={formData.code}
                                onChange={(event) => setField('code', event.target.value.replace(/\D+/g, '').slice(0, 6))}
                                placeholder="000000"
                                inputMode="numeric"
                                pattern="[0-9]{6}"
                            />
                        </div>
                    </label>

                    <label className="auth-field">
                        Nueva contrasena
                        <div className="input-row">
                            <span className="material-symbols-outlined">lock</span>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={formData.password}
                                onChange={(event) => setField('password', event.target.value)}
                                placeholder="Minimo 8 caracteres"
                            />
                        </div>
                    </label>

                    <label className="auth-field">
                        Confirmar contrasena
                        <div className="input-row">
                            <span className="material-symbols-outlined">verified_user</span>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={formData.confirmPassword}
                                onChange={(event) => setField('confirmPassword', event.target.value)}
                                placeholder="Repite la nueva contrasena"
                            />
                        </div>
                    </label>

                    <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
                        {submitting ? 'Actualizando...' : 'Actualizar contrasena'}
                    </button>
                </form>

                <div className="auth-actions-grid">
                    <Link to="/forgot-password" className="btn btn-ghost auth-mini-btn">Solicitar otro codigo</Link>
                    <Link to="/login" className="btn btn-ghost auth-mini-btn">Volver al inicio</Link>
                </div>
            </div>
        </div>
    );
}
