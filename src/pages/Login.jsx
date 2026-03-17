import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';

// Staging update: Sign Up button text
export default function Login() {
    const { login, registerAdmin } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [allowRegistration, setAllowRegistration] = useState(false);

    useEffect(() => {
        const loadPublicPlatform = async () => {
            try {
                const response = await apiRequest('/public/platform');
                setAllowRegistration(Boolean(response?.allowAdminRegistration));
            } catch {
                setAllowRegistration(false);
            }
        };

        loadPublicPlatform();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            showToast('Ingresa correo y contrasena');
            return;
        }

        try {
            await login(email, password);
            showToast(`Bienvenido`);
            navigate('/dashboard');
        } catch (error) {
            showToast(error.message || 'Credenciales invalidas');
        }
    };

    const handleRegister = async () => {
        if (!email || !password) {
            showToast('Ingresa correo y contrasena para crear el usuario');
            return;
        }

        try {
            await registerAdmin(email, password);
            navigate('/dashboard');
        } catch (error) {
            showToast(error.message || 'No se pudo crear el usuario');
        }
    };

    const handleForgotPassword = () => {
        showToast('Solicita recuperacion de acceso al superadministrador');
    };

    return (
        <section id="login-screen" className="screen">
            <div className="auth-shell">
                <form id="login-form" className="auth-card" onSubmit={handleSubmit}>
                    <div className="auth-header">
                        <div className="auth-icon"><span className="material-symbols-outlined">lock</span></div>
                        <h1>Welcome Back</h1>
                        <p>Log in to manage your microloan portfolio</p>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="login-email">Email Address</label>
                        <div className="input-row">
                            <span className="material-symbols-outlined">mail</span>
                            <input
                                id="login-email"
                                type="email"
                                required
                                placeholder="name@company.com"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="auth-field">
                        <div className="password-head">
                            <label htmlFor="login-password">Password</label>
                            <button type="button" className="link-btn" id="forgot-password-btn" onClick={handleForgotPassword}>Forgot Password?</button>
                        </div>
                        <div className="input-row">
                            <span className="material-symbols-outlined">lock</span>
                            <input
                                id="login-password"
                                type={showPassword ? "text" : "password"}
                                required
                                placeholder="********"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="icon-btn"
                                id="toggle-password-btn"
                                aria-label="Mostrar u ocultar contrasena"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                    </div>

                    <label className="remember-row" htmlFor="remember-device">
                        <input id="remember-device" type="checkbox" />
                        <span>Remember this device</span>
                    </label>

                    <div className="auth-primary-actions">
                        <button type="submit" className="btn btn-primary auth-submit">
                            <span>Sign In</span>
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                        {allowRegistration && (
                            <button
                                id="create-user-btn"
                                type="button"
                                className="btn btn-ghost auth-submit auth-signup-btn"
                                onClick={handleRegister}
                            >
                                Sign Up
                            </button>
                        )}
                    </div>

                    {!allowRegistration && (
                        <p className="muted small">El registro de nuevos workspaces esta deshabilitado. Solicitalo al superadministrador.</p>
                    )}

                </form>
            </div>
        </section>
    );
}
