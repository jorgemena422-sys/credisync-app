import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
    clearRecoverySession,
    initializeRecoverySessionFromUrl,
    updateRecoveryPassword
} from '../utils/supabaseBrowser';

export default function ResetPasswordNew() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);
    const [sessionError, setSessionError] = useState('');
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        let mounted = true;

        const setupRecoverySession = async () => {
            try {
                const session = await initializeRecoverySessionFromUrl();
                if (!mounted) {
                    return;
                }

                if (!session) {
                    setSessionError('El enlace de recuperacion es invalido, ya fue usado o expiro. Solicita uno nuevo.');
                    return;
                }

                setSessionReady(true);
            } catch (error) {
                if (!mounted) {
                    return;
                }
                setSessionError(error.message || 'No se pudo validar el enlace de recuperacion.');
            } finally {
                if (mounted) {
                    setCheckingSession(false);
                }
            }
        };

        setupRecoverySession();

        return () => {
            mounted = false;
        };
    }, []);

    const passwordChecks = useMemo(() => ({
        minLength: formData.password.length >= 8,
        matches: formData.password.length > 0 && formData.password === formData.confirmPassword
    }), [formData.confirmPassword, formData.password]);

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!sessionReady) {
            showToast('Tu enlace de recuperacion ya no es valido. Solicita uno nuevo.');
            return;
        }

        if (formData.password.length < 8) {
            showToast('La contrasena debe tener al menos 8 caracteres');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            showToast('Las contrasenas no coinciden');
            return;
        }

        setLoading(true);

        try {
            await updateRecoveryPassword(formData.password);
            await clearRecoverySession();
            showToast('Contrasena actualizada exitosamente. Ya puedes iniciar sesion.');
            setTimeout(() => {
                navigate('/');
            }, 1200);
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar la contrasena. Solicita un nuevo enlace.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-dark flex items-center justify-center font-sans antialiased text-white">
            <main className="w-full max-w-[506px] p-4">
                <div className="bg-brand-card border border-brand-border rounded-[2.5rem] p-8 md:p-12 shadow-2xl">
                    <section className="flex flex-col items-center text-center mb-8">
                        <div className="relative w-20 h-20 flex items-center justify-center mb-6">
                            <div className="absolute inset-0 icon-glow rounded-full"></div>
                            <div className="w-12 h-12 bg-[#252a33] rounded-full flex items-center justify-center border border-brand-border">
                                <svg className="h-6 w-6 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold mb-3 tracking-tight">Nueva contrasena</h1>
                        <p className="text-brand-textMuted text-sm max-w-xs">
                            Crea una contrasena segura para recuperar el acceso a tu cuenta.
                        </p>
                    </section>

                    {checkingSession ? (
                        <div className="bg-brand-dark/50 border border-brand-border rounded-xl p-5 text-center">
                            <p className="text-sm text-brand-textMuted">Validando enlace de recuperacion...</p>
                        </div>
                    ) : sessionError ? (
                        <div className="space-y-5">
                            <div className="bg-brand-dark/50 border border-brand-border rounded-xl p-5">
                                <p className="text-sm text-brand-textMuted leading-6">{sessionError}</p>
                            </div>
                            <button
                                type="button"
                                className="w-full flex items-center justify-center bg-brand-accent hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all btn-glow"
                                onClick={() => navigate('/reset-password')}
                            >
                                Solicitar nuevo enlace
                            </button>
                        </div>
                    ) : (
                        <form className="space-y-6" data-purpose="reset-new-password-form" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-brand-textMuted ml-1" htmlFor="password">
                                    Nueva contrasena
                                </label>
                                <div className="relative dark-input-focus transition-all duration-200 bg-brand-dark border border-brand-border rounded-xl">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-brand-textMuted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    </div>
                                    <input
                                        className="block w-full pl-11 pr-12 py-4 bg-transparent border-none text-white placeholder-brand-textMuted focus:ring-0 rounded-xl text-md"
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Minimo 8 caracteres"
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        disabled={loading}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                    >
                                        <svg className="h-5 w-5 text-brand-textMuted hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {showPassword ? (
                                                <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a9.042 9.042 0 017.538 2.478M9 12h.01m12-2a9.97 9.97 0 011.563 3.029c-1.275 4.057-5.065 7-9.543 7a9.97 9.97 0 01-1.875-.175m-5.858-5.908a9.042 9.042 0 017.538-2.478" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            ) : (
                                                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            )}
                                            {showPassword ? null : (
                                                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.543-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            )}
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-brand-textMuted ml-1" htmlFor="confirmPassword">
                                    Confirmar contrasena
                                </label>
                                <div className="relative dark-input-focus transition-all duration-200 bg-brand-dark border border-brand-border rounded-xl">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-brand-textMuted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    </div>
                                    <input
                                        className="block w-full pl-11 pr-4 py-4 bg-transparent border-none text-white placeholder-brand-textMuted focus:ring-0 rounded-xl text-md"
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Repite tu contrasena"
                                        required
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        disabled={loading}
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>

                            <div className="bg-brand-dark/50 border border-brand-border rounded-xl p-4">
                                <p className="text-xs text-brand-textMuted mb-2">Tu nueva contrasena debe cumplir con:</p>
                                <ul className="space-y-1">
                                    <li className={`text-xs ${passwordChecks.minLength ? 'text-green-400' : 'text-brand-textMuted'}`}>
                                        • Al menos 8 caracteres
                                    </li>
                                    <li className={`text-xs ${passwordChecks.matches ? 'text-green-400' : 'text-brand-textMuted'}`}>
                                        • Confirmacion igual a la nueva contrasena
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-brand-dark/50 border border-brand-border rounded-xl p-4">
                                <p className="text-xs text-brand-textMuted leading-5">
                                    Este enlace es personal y temporal. Si vuelves a solicitar otro correo, usa siempre el enlace mas reciente.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="flex items-center justify-center gap-2 bg-brand-accent hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Guardar nueva contrasena</span>
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            </svg>
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className="flex items-center justify-center bg-[#252a33] hover:bg-[#2d333d] border border-brand-border text-white font-bold py-4 px-6 rounded-xl transition-all"
                                    onClick={() => navigate('/reset-password')}
                                >
                                    Solicitar otro enlace
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
