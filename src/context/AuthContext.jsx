import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchCurrentUser = useCallback(async () => {
        try {
            const response = await apiRequest('/auth/me');
            setCurrentUser(response.user || null);
        } catch (error) {
            setCurrentUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCurrentUser();
    }, [fetchCurrentUser]);

    const login = useCallback(async (email, password) => {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: { email, password },
        });
        if (!response?.user) {
            throw new Error('El backend no devolvio un usuario valido. Revisa la configuracion de Cloud Run/API.');
        }
        setCurrentUser(response.user);
    }, []);

    const logout = useCallback(async () => {
        try {
            await apiRequest('/auth/logout', { method: 'POST' });
        } catch (error) { }
        setCurrentUser(null);
    }, []);

    const registerAdmin = useCallback(async (emailOrPayload, maybePassword) => {
        const payload = emailOrPayload && typeof emailOrPayload === 'object'
            ? emailOrPayload
            : { email: emailOrPayload, password: maybePassword };

        const response = await apiRequest('/auth/register-admin', {
            method: 'POST',
            body: {
                email: payload.email,
                password: payload.password
            },
        });
        if (!response?.user) {
            throw new Error('El backend no devolvio un usuario valido. Revisa la configuracion de Cloud Run/API.');
        }
        setCurrentUser(response.user);
    }, []);

    const isSuperadmin = useCallback(() => {
        const role = currentUser && currentUser.role ? String(currentUser.role).toLowerCase() : '';
        return role.includes('super');
    }, [currentUser]);

    const contextValue = useMemo(() => ({
        currentUser,
        loading,
        login,
        logout,
        registerAdmin,
        isSuperadmin
    }), [currentUser, loading, login, logout, registerAdmin, isSuperadmin]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
