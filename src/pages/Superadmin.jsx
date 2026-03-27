import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../utils/api';
import { formatDate } from '../utils/helpers';
import { statusTag } from './Dashboard';

export default function SuperadminUsers() {
    const { superadminUsers, refreshSuperadminUsers } = useApp();
    const { showToast } = useToast();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const filteredUsers = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return (superadminUsers || []).filter((user) => {
            const haystack = `${user.email || ''} ${user.name || ''} ${user.tenantName || ''} ${user.role || ''}`.toLowerCase();
            return !normalizedQuery || haystack.includes(normalizedQuery);
        });
    }, [superadminUsers, query]);

    const reloadUsers = async () => {
        try {
            setLoading(true);
            await refreshSuperadminUsers();
        } catch (error) {
            showToast(error.message || 'No se pudo cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (user) => {
        const nextStatus = String(user.status || '').toLowerCase() === 'active' ? 'inactive' : 'active';
        try {
            await apiRequest(`/superadmin/users/${user.id}/status`, { method: 'PATCH', body: { status: nextStatus } });
            await reloadUsers();
            showToast('Estado actualizado');
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar estado');
        }
    };

    const updateRole = async (user, role) => {
        try {
            await apiRequest(`/superadmin/users/${user.id}/role`, { method: 'PATCH', body: { role } });
            await reloadUsers();
            showToast('Rol actualizado');
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar rol');
        }
    };

    const resetPassword = async (user) => {
        const password = window.prompt(`Nueva contrasena para ${user.email}:`);
        if (!password) {
            return;
        }
        try {
            await apiRequest(`/superadmin/users/${user.id}/reset-password`, {
                method: 'POST',
                body: { password }
            });
            showToast('Contrasena restablecida');
        } catch (error) {
            showToast(error.message || 'No se pudo restablecer contrasena');
        }
    };

    const deleteUser = async (user) => {
        if (!window.confirm(`Eliminar usuario ${user.email}? Esta accion no se puede deshacer.`)) {
            return;
        }
        try {
            await apiRequest(`/superadmin/users/${user.id}`, { method: 'DELETE' });
            await reloadUsers();
            showToast('Usuario eliminado');
        } catch (error) {
            showToast(error.message || 'No se pudo eliminar usuario');
        }
    };

    return (
        <section className="view superadmin-head">
            <div className="card section-stack superadmin-toolbar">
                <div>
                    <h2>Usuarios globales</h2>
                    <p className="muted">Gestiona roles, acceso y estado de cuentas del sistema.</p>
                </div>
                <div className="action-group-inline">
                    <input
                        className="superadmin-search"
                        placeholder="Buscar por correo, nombre o tenant"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <button type="button" className="btn btn-ghost" onClick={reloadUsers} disabled={loading}>
                        {loading ? 'Actualizando...' : 'Recargar'}
                    </button>
                </div>
            </div>

            <div className="card section-stack">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                <th>Tenant</th>
                                <th>Ultimo acceso</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td data-label="Usuario">
                                        <div className="cell-stack">
                                            <strong>{user.name || '-'}</strong>
                                            <span>{user.email}</span>
                                        </div>
                                    </td>
                                    <td data-label="Rol">{String(user.role || '').toLowerCase()}</td>
                                    <td data-label="Estado">{statusTag(user.status)}</td>
                                    <td data-label="Tenant">{user.tenantName || '-'}</td>
                                    <td data-label="Ultimo acceso">{formatDate(user.lastSignInAt || user.lastLoginAt)}</td>
                                    <td data-label="Acciones">
                                        <div className="action-group-inline">
                                            <button type="button" className="action-link" onClick={() => updateStatus(user)}>
                                                {String(user.status || '').toLowerCase() === 'active' ? 'Desactivar' : 'Activar'}
                                            </button>
                                            <button type="button" className="action-link" onClick={() => updateRole(user, String(user.role || '').toLowerCase().includes('super') ? 'admin' : 'superadmin')}>
                                                {String(user.role || '').toLowerCase().includes('super') ? 'Quitar superadmin' : 'Hacer superadmin'}
                                            </button>
                                            <button type="button" className="action-link" onClick={() => resetPassword(user)}>Reset pass</button>
                                            <button type="button" className="action-link action-link-danger" onClick={() => deleteUser(user)}>Eliminar</button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr className="empty-row"><td colSpan="6"><div className="empty-state compact-empty-state"><h4>No hay usuarios</h4></div></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
