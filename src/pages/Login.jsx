import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [canRegister, setCanRegister] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        businessName: ''
    });

    const { login, registerAdmin } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        const checkRegistrationStatus = async () => {
            try {
                const response = await fetch('/api/public/platform');
                const data = await response.json();
                setCanRegister(Boolean(data.allowAdminRegistration));
            } catch {
                setCanRegister(false);
            }
        };

        checkRegistrationStatus();
    }, []);

    const updateField = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        try {
            if (isLogin) {
                await login(formData.email, formData.password);
                showToast('Bienvenido a CrediSync');
                return;
            }

            await registerAdmin({
                email: formData.email,
                password: formData.password,
                fullName: formData.fullName,
                businessName: formData.businessName
            });

            showToast('Cuenta de administrador creada exitosamente');
            setIsLogin(true);
        } catch (error) {
            showToast(error.message || 'Error en la autenticacion');
        }
    };

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <header className="auth-header">
                    <div className="auth-icon">
                        <span className="material-symbols-outlined">auto_graph</span>
                    </div>
                    <h1>CrediSync</h1>
                    <p>Gestion inteligente de prestamos</p>
                </header>

                <form onSubmit={handleSubmit} className="form-grid">
                    {!isLogin && (
                        <>
                            <label className="auth-field">
                                Nombre completo
                                <div className="input-row">
                                    <span className="material-symbols-outlined">person</span>
                                    <input
                                        type="text"
                                        required
                                        value={formData.fullName}
                                        onChange={(event) => updateField('fullName', event.target.value)}
                                        placeholder="Tu nombre"
                                    />
                                </div>
                            </label>

                            <label className="auth-field">
                                Nombre del negocio
                                <div className="input-row">
                                    <span className="material-symbols-outlined">business</span>
                                    <input
                                        type="text"
                                        required
                                        value={formData.businessName}
                                        onChange={(event) => updateField('businessName', event.target.value)}
                                        placeholder="Ej. Inversiones MJ"
                                    />
                                </div>
                            </label>
                        </>
                    )}

                    <label className="auth-field">
                        Correo electronico
                        <div className="input-row">
                            <span className="material-symbols-outlined">mail</span>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(event) => updateField('email', event.target.value)}
                                placeholder="admin@email.com"
                            />
                        </div>
                    </label>

                    <label className="auth-field">
                        Contrasena
                        <div className="password-head">
                            <span className="muted small">Acceso seguro</span>
                            <button
                                type="button"
                                className="link-btn"
                                onClick={() => navigate('/forgot-password')}
                            >
                                Olvide mi contrasena
                            </button>
                        </div>
                        <div className="input-row">
                            <span className="material-symbols-outlined">lock</span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={formData.password}
                                onChange={(event) => updateField('password', event.target.value)}
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                className="icon-btn"
                                onClick={() => setShowPassword((prev) => !prev)}
                                aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                            >
                                <span className="material-symbols-outlined">
                                    {showPassword ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </label>
                </form>

                <div className="auth-divider">ACCESO</div>

                <div className="auth-actions-grid" style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                    {isLogin ? (
                        <>
                            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit}>
                                Iniciar sesion
                            </button>
                            {canRegister ? (
                                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsLogin(false)}>
                                    Registrate
                                </button>
                            ) : (
                                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} disabled>
                                    Registro deshabilitado
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit}>
                                Crear cuenta administrador
                            </button>
                            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsLogin(true)}>
                                Ya tengo cuenta
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
