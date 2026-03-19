import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { requestPasswordResetEmail } from '../utils/supabaseBrowser';

export default function ResetPasswordCode() {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const searchParams = new URLSearchParams(location.search);
    const email = location.state?.email || searchParams.get('email') || '';
    const [loading, setLoading] = useState(false);

    const handleResendEmail = async () => {
        if (!email) {
            navigate('/reset-password');
            return;
        }

        try {
            setLoading(true);
            const redirectTo = `${window.location.origin}/reset-password-new`;
            await requestPasswordResetEmail(email, redirectTo);
            showToast('Enviamos un nuevo enlace de recuperacion. Revisa tu correo.');
        } catch (error) {
            showToast(error.message || 'No se pudo reenviar el correo de recuperacion.');
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
                                    <path d="M3 8l7.89 4.26a2.25 2.25 0 002.22 0L21 8m-18 8h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v6a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold mb-3 tracking-tight">Revisa tu correo</h1>
                        <p className="text-brand-textMuted text-sm max-w-sm leading-6">
                            {email ? (
                                <>
                                    Te enviamos un enlace de recuperacion a <span className="text-brand-accent">{email}</span>.
                                    Abre el correo y toca el enlace para crear tu nueva contrasena.
                                </>
                            ) : (
                                'Te enviamos un enlace de recuperacion. Abre el correo y toca el enlace para crear tu nueva contrasena.'
                            )}
                        </p>
                    </section>

                    <div className="space-y-5">
                        <div className="bg-brand-dark/50 border border-brand-border rounded-xl p-4">
                            <p className="text-xs text-brand-textMuted leading-5">
                                Si no lo ves en la bandeja principal, revisa spam, promociones o correo no deseado. El enlace mas reciente es el unico que debes usar.
                            </p>
                        </div>

                        <div className="bg-brand-dark/50 border border-brand-border rounded-xl p-4">
                            <p className="text-xs text-brand-textMuted leading-5">
                                Cuando abras el enlace desde el correo, seras redirigido automaticamente a la pantalla para definir tu nueva contrasena.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                            <button
                                type="button"
                                className="flex items-center justify-center gap-2 bg-brand-accent hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleResendEmail}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Reenviando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Reenviar enlace</span>
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 005.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                className="flex items-center justify-center bg-[#252a33] hover:bg-[#2d333d] border border-brand-border text-white font-bold py-4 px-6 rounded-xl transition-all"
                                onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}
                            >
                                Cambiar correo
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
