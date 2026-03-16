import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCurrentUser();
    }, []);

    const fetchCurrentUser = async () => {
        try {
            const response = await apiRequest('/auth/me');
            setCurrentUser(response.user || null);
        } catch (error) {
            setCurrentUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: { email, password },
        });
        if (!response?.user) {
            throw new Error('El backend no devolvio un usuario valido. Revisa la configuracion de Cloud Run/API.');
        }
        setCurrentUser(response.user);
    };

    const logout = async () => {
        try {
            await apiRequest('/auth/logout', { method: 'POST' });
        } catch (error) { }
        setCurrentUser(null);
    };

    const registerAdmin = async (email, password) => {
        const response = await apiRequest('/auth/register-admin', {
            method: 'POST',
            body: { email, password },
        });
        if (!response?.user) {
            throw new Error('El backend no devolvio un usuario valido. Revisa la configuracion de Cloud Run/API.');
        }
        setCurrentUser(response.user);
    };

    const isSuperadmin = () => {
        const role = currentUser && currentUser.role ? String(currentUser.role).toLowerCase() : '';
        return role.includes('super');
    };

    return (
        <AuthContext.Provider value={{ currentUser, loading, login, logout, registerAdmin, isSuperadmin }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
