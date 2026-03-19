import { createClient } from '@supabase/supabase-js';

let clientPromise = null;

async function fetchSupabasePublicConfig() {
    const response = await fetch('/api/auth/supabase-client-config', {
        credentials: 'include'
    });

    let payload = null;
    try {
        payload = await response.json();
    } catch (error) {
        payload = null;
    }

    if (!response.ok) {
        const message = payload?.message || `Error ${response.status}`;
        throw new Error(message);
    }

    if (!payload?.supabaseUrl || !payload?.supabaseAnonKey) {
        throw new Error('No se pudo cargar la configuracion publica de Supabase Auth.');
    }

    return payload;
}

export async function getSupabaseBrowserClient() {
    if (!clientPromise) {
        clientPromise = fetchSupabasePublicConfig().then(({ supabaseUrl, supabaseAnonKey }) => {
            return createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });
        });
    }

    return clientPromise;
}

export async function requestPasswordResetEmail(email, redirectTo) {
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
    });

    if (error) {
        throw error;
    }
}

function readHashParams() {
    const rawHash = String(window.location.hash || '').replace(/^#/, '');
    return new URLSearchParams(rawHash);
}

export async function initializeRecoverySessionFromUrl() {
    const supabase = await getSupabaseBrowserClient();
    const hashParams = readHashParams();
    const queryParams = new URLSearchParams(window.location.search || '');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const hashType = hashParams.get('type');
    const authCode = queryParams.get('code');

    if (accessToken && refreshToken && hashType === 'recovery') {
        const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        if (error) {
            throw error;
        }

        if (window.location.hash) {
            window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
        }

        return data?.session || null;
    }

    if (authCode) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
            throw error;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return data?.session || null;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
        throw error;
    }

    return data?.session || null;
}

export async function updateRecoveryPassword(password) {
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
        throw error;
    }
}

export async function clearRecoverySession() {
    const supabase = await getSupabaseBrowserClient();
    await supabase.auth.signOut();
}
