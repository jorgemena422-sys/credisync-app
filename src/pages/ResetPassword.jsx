import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function ResetPassword() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const [hasSession, setHasSession] = useState(false);
    const [supabaseConfig, setSupabaseConfig] = useState(null);

    const supabaseClient = useMemo(() => {
        if (!supabaseConfig?.supabaseUrl || !supabaseConfig?.supabaseAnonKey) {
            return null;
        }
        return createClient(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey);
    }, [supabaseConfig]);

    useEffect(() => {
        let mounted = true;

        const bootstrap = async () => {
            try {
                const config = await apiRequest('/auth/supabase-client-config');
                if (!mounted) return;
                setSupabaseConfig(config);

                const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
                const { data, error } = await client.auth.getSession();
                if (!mounted) return;

                if (error) {
                    throw error;
                }

                setHasSession(Boolean(data?.session));
            } catch (error) {
                if (mounted) {
                    setHasSession(false);
                    showToast(error.message || 'No se pudo validar el enlace de recuperacion');
                }
            } finally {
                if (mounted) {
                    setCheckingSession(false);
                }
            }
        };

        bootstrap();

        return () => {
            mounted = false;
        };
    }, [showToast]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!supabaseClient) {
            showToast('No se pudo inicializar la recuperacion de contrasena');
            return;
        }

        if (!password || !confirmPassword) {
            showToast('Completa los campos requeridos');
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
            const { error } = await supabaseClient.auth.updateUser({ password });
            if (error) {
                throw error;
            }

            showToast('Contrasena actualizada. Inicia sesion nuevamente.');
            navigate('/login', { replace: true });
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar la contrasena');
        } finally {
            setSubmitting(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="auth-shell">
                <div className="auth-card">
                    <div className="empty-state">
                        <span className="material-symbols-outlined">hourglass_top</span>
                        <h4>Validando enlace de recuperacion...</h4>
                    </div>
                </div>
            </div>
        );
    }

    if (!hasSession) {
        return (
            <div className="auth-shell">
                <div className="auth-card">
                    <div className="empty-state">
                        <span className="material-symbols-outlined">link_off</span>
                        <h4>Enlace invalido o expirado</h4>
                        <p>Solicita un nuevo correo de recuperacion para continuar.</p>
                    </div>
                    <div className="auth-actions-grid">
                        <Link to="/forgot-password" className="btn btn-primary auth-mini-btn">Solicitar nuevo enlace</Link>
                        <Link to="/login" className="btn btn-ghost auth-mini-btn">Volver al inicio</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <header className="auth-header">
                    <div className="auth-icon">
                        <span className="material-symbols-outlined">lock_reset</span>
                    </div>
                    <h1>Nueva contrasena</h1>
                    <p>Actualiza tu acceso de forma segura.</p>
                </header>

                <form onSubmit={handleSubmit} className="form-grid">
                    <label className="auth-field">
                        Nueva contrasena
                        <div className="input-row">
                            <span className="material-symbols-outlined">lock</span>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
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
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                placeholder="Repite la nueva contrasena"
                            />
                        </div>
                    </label>

                    <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
                        {submitting ? 'Actualizando...' : 'Guardar contrasena'}
                    </button>
                </form>
            </div>
        </div>
    );
}
