import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function ForgotPassword() {
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const requestSupabaseFallbackReset = async (targetEmail) => {
        const config = await apiRequest('/auth/supabase-client-config');
        const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, { redirectTo });
        if (error) {
            throw error;
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!String(email || '').trim()) {
            showToast('Ingresa un correo valido');
            return;
        }

        try {
            setSubmitting(true);
            const normalizedEmail = String(email || '').trim().toLowerCase();
            await requestSupabaseFallbackReset(normalizedEmail);

            setSent(true);
            showToast('Enviamos un enlace de recuperacion a tu correo');
        } catch (error) {
            // Optional fallback to legacy code flow when direct reset fails.
            try {
                const normalizedEmail = String(email || '').trim().toLowerCase();
                await apiRequest('/auth/request-password-reset', {
                    method: 'POST',
                    body: { email: normalizedEmail }
                });
                setSent(true);
                showToast('Enviamos un correo de recuperacion');
            } catch (legacyError) {
                showToast(legacyError.message || error.message || 'No se pudo enviar el correo de recuperacion');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <header className="auth-header">
                    <div className="auth-icon">
                        <span className="material-symbols-outlined">key</span>
                    </div>
                    <h1>Recuperar contrasena</h1>
                    <p>Te enviaremos un codigo para restablecer tu acceso.</p>
                </header>

                <form onSubmit={handleSubmit} className="form-grid">
                    <label className="auth-field">
                        Correo electronico
                        <div className="input-row">
                            <span className="material-symbols-outlined">mail</span>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="tu-correo@dominio.com"
                            />
                        </div>
                    </label>

                    <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
                        {submitting ? 'Enviando...' : 'Enviar codigo'}
                    </button>
                </form>

                {sent ? (
                    <div className="status status-active" style={{ justifyContent: 'center' }}>
                        Revisa tu correo y abre el enlace de recuperacion.
                    </div>
                ) : null}

                <div className="auth-actions-grid">
                    <Link to="/reset-password-code" className="btn btn-ghost auth-mini-btn">Ya tengo un codigo</Link>
                    <Link to="/login" className="btn btn-ghost auth-mini-btn">Volver al inicio</Link>
                </div>
            </div>
        </div>
    );
}
