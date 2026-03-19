import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { requestPasswordResetEmail } from '../utils/supabaseBrowser';

export default function ResetPassword() {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const searchParams = new URLSearchParams(location.search);
    const [email, setEmail] = useState(location.state?.email || searchParams.get('email') || '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email) {
            showToast('Ingresa tu correo electrónico');
            return;
        }

        setLoading(true);

        try {
            const redirectTo = `${window.location.origin}/reset-password-new`;
            await requestPasswordResetEmail(email, redirectTo);

            showToast('Te enviamos un enlace de recuperacion. Revisa tu correo.');
            navigate(`/reset-password-code?email=${encodeURIComponent(email)}`, { state: { email } });
        } catch (error) {
            showToast(error.message || 'No se pudo enviar el correo de recuperacion. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-dark flex items-center justify-center font-sans antialiased text-white">
            <main className="w-full max-w-[506px] p-4">
                <div className="bg-brand-card border border-brand-border rounded-[2.5rem] p-8 md:p-12 shadow-2xl">
                    {/* Header Section */}
                    <section className="flex flex-col items-center text-center mb-8">
                        {/* Icon Container with Glow */}
                        <div className="relative w-20 h-20 flex items-center justify-center mb-6">
                            <div className="absolute inset-0 icon-glow rounded-full"></div>
                            <div className="w-12 h-12 bg-[#252a33] rounded-full flex items-center justify-center border border-brand-border">
                                <svg className="h-6 w-6 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold mb-3 tracking-tight">Restablecer Contraseña</h1>
                        <p className="text-brand-textMuted text-sm max-w-xs">
                            Ingresa tu correo electronico para recibir un enlace de recuperacion
                        </p>
                    </section>

                    {/* Form Section */}
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-brand-textMuted ml-1" htmlFor="email">
                                Correo Electrónico
                            </label>
                            <div className="relative dark-input-focus transition-all duration-200 bg-brand-dark border border-brand-border rounded-xl">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-brand-textMuted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                </div>
                                <input
                                    className="block w-full pl-11 pr-4 py-4 bg-transparent border-none text-white placeholder-brand-textMuted focus:ring-0 rounded-xl text-md"
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="nombre@compania.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="bg-brand-dark/50 border border-brand-border rounded-xl p-4">
                            <p className="text-xs text-brand-textMuted leading-5">
                                Si no llega el correo en unos minutos, revisa spam o promociones. Si el problema continua, intenta otra vez mas tarde o contacta soporte.
                            </p>
                        </div>

                        {/* Action Buttons */}
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
                                        <span>Enviando enlace...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Enviar enlace</span>
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                className="flex items-center justify-center bg-[#252a33] hover:bg-[#2d333d] border border-brand-border text-white font-bold py-4 px-6 rounded-xl transition-all"
                                onClick={() => navigate('/')}
                            >
                                Volver
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
