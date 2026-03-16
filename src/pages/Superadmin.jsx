import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Drawer from '../components/Drawer';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../utils/api';
import { formatDate, initials, money } from '../utils/helpers';
import { statusTag } from './Dashboard';

function roleTag(role) {
    const normalized = String(role || '').toLowerCase();
    const isSuper = normalized.includes('super');
    return <span className={`role-pill ${isSuper ? 'role-super' : 'role-admin'}`}>{role || '-'}</span>;
}

function boolTag(value, trueLabel = 'Si', falseLabel = 'No') {
    return <span className={`status ${value ? 'status-active' : 'status-inactive'}`}>{value ? trueLabel : falseLabel}</span>;
}

function matchesTenantFilter(user, tenantFilter) {
    if (tenantFilter === 'assigned') return Boolean(user.tenantId);
    if (tenantFilter === 'unassigned') return !user.tenantId;
    return true;
}

function StatCard({ label, value, tone = 'primary' }) {
    return (
        <article className={`kpi motion-item stat-${tone}`}>
            <div className="kpi-top">
                <span className="material-symbols-outlined">monitoring</span>
                <p>{label}</p>
            </div>
            <h4>{value}</h4>
        </article>
    );
}

export default function Superadmin() {
    const { superadminUsers, refreshSuperadminUsers } = useApp();
    const { showToast } = useToast();
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [tenantFilter, setTenantFilter] = useState('all');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState('');
    const [roleDraft, setRoleDraft] = useState('Administrador');
    const [newPassword, setNewPassword] = useState('');

    const metrics = useMemo(() => {
        const users = superadminUsers || [];
        return {
            total: users.length,
            active: users.filter((user) => user.status === 'active').length,
            inactive: users.filter((user) => user.status !== 'active').length,
            noTenant: users.filter((user) => !user.tenantId).length,
            unconfirmed: users.filter((user) => !user.emailConfirmed).length
        };
    }, [superadminUsers]);

    const sortedUsers = useMemo(() => {
        return [...(superadminUsers || [])].sort((a, b) => {
            const rank = (user) => {
                if (user.status !== 'active') return 0;
                if (!user.tenantId) return 1;
                if (!user.emailConfirmed) return 2;
                return 3;
            };

            const rankDiff = rank(a) - rank(b);
            if (rankDiff !== 0) return rankDiff;

            const left = new Date(a.lastSignInAt || a.createdAt || 0).getTime();
            const right = new Date(b.lastSignInAt || b.createdAt || 0).getTime();
            return right - left;
        });
    }, [superadminUsers]);

    const filteredUsers = useMemo(() => {
        const term = query.trim().toLowerCase();
        return sortedUsers.filter((user) => {
            const haystack = [
                user.name,
                user.email,
                user.role,
                user.tenantId,
                user.tenantName,
                user.status,
                user.tenantStatus
            ].join(' ').toLowerCase();

            const matchesQuery = !term || haystack.includes(term);
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
            return matchesQuery && matchesRole && matchesStatus && matchesTenantFilter(user, tenantFilter);
        });
    }, [query, roleFilter, statusFilter, tenantFilter, sortedUsers]);

    const urgentQueues = useMemo(() => ([
        {
            id: 'inactive',
            label: 'Cuentas inactivas',
            helper: 'Recuperar acceso o revisar bloqueos',
            value: metrics.inactive,
            tone: 'warn',
            onClick: () => {
                setStatusFilter('inactive');
                setTenantFilter('all');
                setRoleFilter('all');
                setQuery('');
            }
        },
        {
            id: 'unassigned',
            label: 'Sin tenant',
            helper: 'Usuarios sin workspace provisionado',
            value: metrics.noTenant,
            tone: 'neutral',
            onClick: () => {
                setTenantFilter('unassigned');
                setStatusFilter('all');
                setRoleFilter('all');
                setQuery('');
            }
        },
        {
            id: 'unconfirmed',
            label: 'Email pendiente',
            helper: 'Pendientes de confirmacion',
            value: metrics.unconfirmed,
            tone: 'bad',
            onClick: () => {
                setQuery('');
                setRoleFilter('all');
                setStatusFilter('all');
                setTenantFilter('all');
            }
        }
    ]), [metrics]);

    const selectedUser = useMemo(() => {
        return (superadminUsers || []).find((user) => user.id === selectedUserId) || null;
    }, [superadminUsers, selectedUserId]);

    useEffect(() => {
        if (!selectedUser && selectedUserId) {
            setSelectedUserId(null);
            setDetailData(null);
        }
    }, [selectedUser, selectedUserId]);

    useEffect(() => {
        if (selectedUser) {
            setRoleDraft(selectedUser.role || 'Administrador');
        }
    }, [selectedUser]);

    const loadUserDetail = async (user) => {
        setSelectedUserId(user.id);
        setNewPassword('');

        if (!user.tenantId) {
            setDetailData(null);
            return;
        }

        try {
            setDetailLoading(true);
            const response = await apiRequest(`/superadmin/tenants/${user.tenantId}/audit`);
            setDetailData(response);
        } catch (error) {
            setDetailData(null);
            showToast(error.message || 'No fue posible cargar el detalle del tenant');
        } finally {
            setDetailLoading(false);
        }
    };

    const closeDrawer = () => {
        setSelectedUserId(null);
        setDetailData(null);
        setNewPassword('');
        setActionLoading('');
    };

    const syncAfterMutation = async (userId) => {
        const users = await refreshSuperadminUsers();
        const updated = users.find((item) => item.id === userId) || null;

        if (!updated) {
            closeDrawer();
            return;
        }

        setSelectedUserId(updated.id);
        if (updated.tenantId) {
            try {
                setDetailLoading(true);
                const response = await apiRequest(`/superadmin/tenants/${updated.tenantId}/audit`);
                setDetailData(response);
            } catch (error) {
                setDetailData(null);
            } finally {
                setDetailLoading(false);
            }
        } else {
            setDetailData(null);
        }
    };

    const handleStatusToggle = async () => {
        if (!selectedUser) return;
        const nextStatus = selectedUser.status === 'active' ? 'inactive' : 'active';

        try {
            setActionLoading('status');
            await apiRequest(`/superadmin/users/${selectedUser.id}/status`, {
                method: 'PATCH',
                body: { status: nextStatus }
            });
            await syncAfterMutation(selectedUser.id);
            showToast(nextStatus === 'active' ? 'Cuenta reactivada' : 'Cuenta desactivada');
        } catch (error) {
            showToast(error.message || 'No fue posible actualizar el estado');
        } finally {
            setActionLoading('');
        }
    };

    const handleRoleUpdate = async () => {
        if (!selectedUser || !roleDraft || roleDraft === selectedUser.role) return;

        try {
            setActionLoading('role');
            await apiRequest(`/superadmin/users/${selectedUser.id}/role`, {
                method: 'PATCH',
                body: { role: roleDraft }
            });
            await syncAfterMutation(selectedUser.id);
            showToast('Rol actualizado correctamente');
        } catch (error) {
            showToast(error.message || 'No fue posible cambiar el rol');
        } finally {
            setActionLoading('');
        }
    };

    const handlePasswordReset = async () => {
        if (!selectedUser) return;
        if (newPassword.trim().length < 8) {
            showToast('La nueva contrasena debe tener al menos 8 caracteres');
            return;
        }

        try {
            setActionLoading('password');
            await apiRequest(`/superadmin/users/${selectedUser.id}/reset-password`, {
                method: 'POST',
                body: { password: newPassword.trim() }
            });
            setNewPassword('');
            showToast('Contrasena restablecida');
        } catch (error) {
            showToast(error.message || 'No fue posible restablecer la contrasena');
        } finally {
            setActionLoading('');
        }
    };

    const handleUserDelete = async () => {
        if (!selectedUser) return;
        
        const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${selectedUser.name || selectedUser.email}? Esta acción no se puede deshacer y borrará los registros de la base de datos y autenticación.`);
        if (!confirmed) return;

        try {
            setActionLoading('delete');
            await apiRequest(`/superadmin/users/${selectedUser.id}`, {
                method: 'DELETE'
            });
            showToast('Usuario eliminado correctamente');
            
            // Critical: Clean up state and close drawer
            setSelectedUserId(null);
            setDetailData(null);
            await refreshSuperadminUsers();
        } catch (error) {
            showToast(error.message || 'No fue posible eliminar el usuario');
        } finally {
            setActionLoading('');
        }
    };

    const state = detailData?.state || null;
    const tenant = detailData?.tenant || null;

    return (
        <>
            <section id="view-superadmin" className="view">
                <div className="card section-stack superadmin-head">
                    <div className="section-head split">
                        <div>
                            <h3>Usuarios de plataforma</h3>
                            <p className="muted">Administra cuentas, permisos y accesos sin mezclar la operacion diaria de un tenant.</p>
                        </div>
                        <span className="status status-active">Acceso total</span>
                    </div>
                    <div className="superadmin-priority-strip">
                        {urgentQueues.map((queue) => (
                            <button key={queue.id} type="button" className={`superadmin-priority-card tone-${queue.tone}`} onClick={queue.onClick}>
                                <span className="superadmin-priority-value">{queue.value}</span>
                                <strong>{queue.label}</strong>
                                <span className="muted small">{queue.helper}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="kpi-grid">
                    <StatCard label="Usuarios totales" value={metrics.total} />
                    <StatCard label="Cuentas activas" value={metrics.active} tone="good" />
                    <StatCard label="Cuentas inactivas" value={metrics.inactive} tone="warn" />
                    <StatCard label="Sin tenant" value={metrics.noTenant} tone="neutral" />
                    <StatCard label="Email sin confirmar" value={metrics.unconfirmed} tone="bad" />
                </div>

                <div className="superadmin-layout">
                    <div className="card section-stack superadmin-main-panel">
                        <div className="section-head split">
                            <div>
                                <h3>Gestion de usuarios</h3>
                                <p className="muted">Filtra, prioriza y abre el detalle de cada cuenta desde una sola bandeja.</p>
                            </div>
                            <span className="muted small">{filteredUsers.length} resultado(s)</span>
                        </div>

                        <div className="superadmin-toolbar">
                            <label className="input-row superadmin-search">
                                <span className="material-symbols-outlined">search</span>
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Buscar por nombre, correo, tenant o rol"
                                />
                            </label>

                            <div className="superadmin-filters-grid">
                                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                                    <option value="all">Todos los roles</option>
                                    <option value="SuperAdministrador">SuperAdministrador</option>
                                    <option value="Administrador">Administrador</option>
                                </select>

                                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                                    <option value="all">Todos los estados</option>
                                    <option value="active">Activos</option>
                                    <option value="inactive">Inactivos</option>
                                </select>

                                <select value={tenantFilter} onChange={(event) => setTenantFilter(event.target.value)}>
                                    <option value="all">Todos los tenants</option>
                                    <option value="assigned">Con tenant</option>
                                    <option value="unassigned">Sin tenant</option>
                                </select>
                            </div>
                        </div>

                        <div className="superadmin-quick-filters">
                            <button type="button" className={`superadmin-chip ${roleFilter === 'all' && statusFilter === 'all' && tenantFilter === 'all' && !query ? 'active' : ''}`} onClick={() => {
                                setQuery('');
                                setRoleFilter('all');
                                setStatusFilter('all');
                                setTenantFilter('all');
                            }}>Vista general</button>
                            <button type="button" className={`superadmin-chip ${statusFilter === 'inactive' ? 'active' : ''}`} onClick={() => setStatusFilter('inactive')}>Inactivos</button>
                            <button type="button" className={`superadmin-chip ${tenantFilter === 'unassigned' ? 'active' : ''}`} onClick={() => setTenantFilter('unassigned')}>Sin tenant</button>
                            <button type="button" className={`superadmin-chip ${roleFilter === 'SuperAdministrador' ? 'active' : ''}`} onClick={() => setRoleFilter('SuperAdministrador')}>Superadmins</button>
                            <button type="button" className="superadmin-chip" onClick={() => refreshSuperadminUsers()}>Actualizar listado</button>
                        </div>

                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Usuario</th>
                                        <th>Tenant</th>
                                        <th>Rol</th>
                                        <th>Estado</th>
                                        <th>Acceso</th>
                                        <th>Correo</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((user) => (
                                            <tr key={user.id} className={`motion-item ${selectedUserId === user.id ? 'superadmin-row-active' : ''}`}>
                                                <td data-label="Usuario">
                                                    <div className="cell-stack">
                                                        <strong>{user.name || 'Sin nombre'}</strong>
                                                        <span className="muted tiny">{user.id}</span>
                                                        <span className="muted small">{user.email}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Tenant">
                                                    <div className="cell-stack">
                                                        <strong>{user.tenantName || 'Sin tenant asignado'}</strong>
                                                        <span className="muted small"><code>{user.tenantId || '-'}</code></span>
                                                    </div>
                                                </td>
                                                <td data-label="Rol">{roleTag(user.role)}</td>
                                                <td data-label="Estado">
                                                    <div className="cell-stack">
                                                        {statusTag(user.status)}
                                                        {user.tenantId && <span className={`status status-${user.tenantStatus || 'inactive'}`}>Tenant {user.tenantStatus === 'active' ? 'activo' : 'inactivo'}</span>}
                                                    </div>
                                                </td>
                                                <td data-label="Acceso">
                                                    <div className="cell-stack">
                                                        <strong>{formatDate(user.lastSignInAt || user.lastLoginAt)}</strong>
                                                        <span className="muted small">Alta: {formatDate(user.createdAt)}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Correo">{boolTag(user.emailConfirmed, 'Confirmado', 'Pendiente')}</td>
                                                <td data-label="Acciones">
                                                    <div className="superadmin-row-actions">
                                                        <button type="button" className="action-link" onClick={() => loadUserDetail(user)}>
                                                            Ver detalle
                                                        </button>
                                                        {user.tenantId && <Link to={`/superadmin/audit/${user.tenantId}`} className="action-link">Auditoria</Link>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr className="empty-row">
                                            <td colSpan="7">
                                                <div className="empty-state">
                                                    <span className="material-symbols-outlined">manage_search</span>
                                                    <h4>No hay coincidencias</h4>
                                                    <p>Ajusta la busqueda o los filtros para encontrar el usuario que necesitas administrar.</p>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost"
                                                        onClick={() => {
                                                            setQuery('');
                                                            setRoleFilter('all');
                                                            setStatusFilter('all');
                                                            setTenantFilter('all');
                                                        }}
                                                    >
                                                        Limpiar filtros
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <aside className="card section-stack superadmin-side-panel">
                        <div className="section-head">
                            <h3>Centro de control</h3>
                        </div>
                        <div className="superadmin-list">
                            <div className="superadmin-list-item stack-item">
                                <div>
                                    <span className="muted small">Siguiente revision</span>
                                    <strong>{metrics.inactive > 0 ? 'Cuentas inactivas' : metrics.noTenant > 0 ? 'Provisionar tenants' : 'Monitoreo general'}</strong>
                                </div>
                                <span className={`status ${metrics.inactive > 0 ? 'status-pending' : 'status-active'}`}>{metrics.inactive + metrics.noTenant}</span>
                            </div>
                            <div className="superadmin-list-item stack-item">
                                <div>
                                    <span className="muted small">Usuarios con workspace</span>
                                    <strong>{metrics.total - metrics.noTenant}</strong>
                                </div>
                                <span className="status status-active">Operando</span>
                            </div>
                            <div className="superadmin-list-item stack-item">
                                <div>
                                    <span className="muted small">Estado del modulo</span>
                                    <strong>Panel listo para soporte</strong>
                                </div>
                                <span className="status status-active">En linea</span>
                            </div>
                        </div>

                        <div className="superadmin-inspector">
                            <h4>Foco actual</h4>
                            {selectedUser ? (
                                <div className="superadmin-focus-card">
                                    <strong>{selectedUser.name || selectedUser.email}</strong>
                                    <span className="muted small">{selectedUser.email}</span>
                                    <div className="superadmin-inline-meta">
                                        {roleTag(selectedUser.role)}
                                        {statusTag(selectedUser.status)}
                                    </div>
                                    <p className="muted small">Abre el panel lateral para cambiar rol, estado o contrasena.</p>
                                    <button type="button" className="btn btn-primary" onClick={() => loadUserDetail(selectedUser)}>Abrir detalle</button>
                                </div>
                            ) : (
                                <div className="empty-state compact-empty-state">
                                    <span className="material-symbols-outlined">left_click</span>
                                    <h4>Selecciona un usuario</h4>
                                    <p>Usa la tabla para abrir el panel lateral y administrar la cuenta elegida.</p>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </section>

            <Drawer isOpen={Boolean(selectedUser)} onClose={closeDrawer} title="Detalle del usuario" className="superadmin-drawer">
                {selectedUser && (
                    <>
                        <div className="card section-stack superadmin-profile">
                            <div className="superadmin-profile-head">
                                <div className="avatar-badge">{initials(selectedUser.name || selectedUser.email)}</div>
                                <div>
                                    <h4>{selectedUser.name || 'Usuario sin nombre'}</h4>
                                    <p className="muted">{selectedUser.email}</p>
                                    <div className="superadmin-inline-meta">
                                        {roleTag(selectedUser.role)}
                                        {statusTag(selectedUser.status)}
                                        {boolTag(selectedUser.emailConfirmed, 'Email confirmado', 'Email pendiente')}
                                    </div>
                                </div>
                            </div>

                            <div className="detail-metrics">
                                <div className="metric">
                                    <p>Tenant</p>
                                    <strong>{selectedUser.tenantName || 'Sin asignar'}</strong>
                                </div>
                                <div className="metric">
                                    <p>Ultimo acceso</p>
                                    <strong>{formatDate(selectedUser.lastSignInAt || selectedUser.lastLoginAt)}</strong>
                                </div>
                                <div className="metric">
                                    <p>Fecha de alta</p>
                                    <strong>{formatDate(selectedUser.createdAt)}</strong>
                                </div>
                                <div className="metric">
                                    <p>ID</p>
                                    <strong>{selectedUser.id}</strong>
                                </div>
                            </div>
                        </div>

                        {detailLoading ? (
                            <div className="empty-state compact-empty-state">
                                <span className="material-symbols-outlined">hourglass_top</span>
                                <h4>Cargando informacion del tenant</h4>
                            </div>
                        ) : selectedUser.tenantId && tenant && state ? (
                            <>
                                <div className="card section-stack">
                                    <div className="section-head split">
                                        <div>
                                            <h4>Workspace</h4>
                                            <p className="muted">Resumen operativo del tenant asociado al usuario.</p>
                                        </div>
                                        {statusTag(tenant.status)}
                                    </div>
                                    <div className="detail-metrics">
                                        <div className="metric">
                                            <p>Clientes</p>
                                            <strong>{state.customers.length}</strong>
                                        </div>
                                        <div className="metric">
                                            <p>Prestamos</p>
                                            <strong>{state.loans.length}</strong>
                                        </div>
                                        <div className="metric">
                                            <p>Pagos</p>
                                            <strong>{state.payments.length}</strong>
                                        </div>
                                        <div className="metric">
                                            <p>Capital budget</p>
                                            <strong>{money(state.settings?.capitalBudget || 0)}</strong>
                                        </div>
                                    </div>
                                    <div className="cell-stack">
                                        <span className="muted small">Tenant: <code>{tenant.id}</code></span>
                                        <span className="muted small">Creado: {formatDate(tenant.created_at || tenant.createdAt)}</span>
                                    </div>
                                    <Link to={`/superadmin/audit/${tenant.id}`} className="action-link superadmin-inline-btn">Abrir auditoria completa</Link>
                                </div>

                                <div className="card section-stack">
                                    <div className="section-head">
                                        <h4>Actividad reciente</h4>
                                    </div>
                                    <div className="superadmin-list">
                                        <div className="superadmin-list-item">
                                            <span className="muted small">Usuarios del tenant</span>
                                            <strong>{state.users.length}</strong>
                                        </div>
                                        <div className="superadmin-list-item">
                                            <span className="muted small">Clientes registrados</span>
                                            <strong>{state.customers.length}</strong>
                                        </div>
                                        <div className="superadmin-list-item">
                                            <span className="muted small">Prestamos activos</span>
                                            <strong>{state.loans.filter((loan) => loan.status === 'active').length}</strong>
                                        </div>
                                        <div className="superadmin-list-item">
                                            <span className="muted small">Pagos registrados</span>
                                            <strong>{state.payments.length}</strong>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="empty-state compact-empty-state">
                                <span className="material-symbols-outlined">domain_disabled</span>
                                <h4>Sin workspace asociado</h4>
                                <p>Este usuario aun no tiene tenant asignado. Puedes cambiar su rol para provisionar un espacio de trabajo.</p>
                            </div>
                        )}

                        <div className="card section-stack superadmin-action-card">
                            <div className="section-head">
                                <h4>Acciones administrativas</h4>
                            </div>

                            <div className="form-grid">
                                <div className="form-section">
                                    <h5 className="form-section-title">Estado de la cuenta</h5>
                                    <p className="muted small">Activa o bloquea el acceso del usuario y, si existe tenant, sincroniza tambien el estado del workspace.</p>
                                    <button type="button" className="btn btn-ghost" disabled={actionLoading === 'status'} onClick={handleStatusToggle}>
                                        {actionLoading === 'status' ? 'Guardando...' : selectedUser.status === 'active' ? 'Desactivar cuenta' : 'Reactivar cuenta'}
                                    </button>
                                </div>

                                <div className="form-section">
                                    <h5 className="form-section-title">Rol y alcance</h5>
                                    <p className="muted small">Promueve o degrada permisos sin salir del panel.</p>
                                    <div className="superadmin-action-row">
                                        <select value={roleDraft} onChange={(event) => setRoleDraft(event.target.value)}>
                                            <option value="Administrador">Administrador</option>
                                            <option value="SuperAdministrador">SuperAdministrador</option>
                                        </select>
                                        <button type="button" className="btn btn-primary" disabled={actionLoading === 'role' || roleDraft === selectedUser.role} onClick={handleRoleUpdate}>
                                            {actionLoading === 'role' ? 'Actualizando...' : 'Actualizar rol'}
                                        </button>
                                    </div>
                                </div>

                                 <div className="form-section">
                                    <h5 className="form-section-title">Reset de contrasena</h5>
                                    <p className="muted small">Genera una nueva contrasena temporal para soporte o recuperacion de acceso.</p>
                                    <div className="superadmin-action-row password-reset-row">
                                        <input
                                            type="text"
                                            value={newPassword}
                                            placeholder="Nueva contrasena temporal"
                                            onChange={(event) => setNewPassword(event.target.value)}
                                        />
                                        <button type="button" className="btn btn-primary" disabled={actionLoading === 'password'} onClick={handlePasswordReset}>
                                            {actionLoading === 'password' ? 'Enviando...' : 'Restablecer'}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h5 className="form-section-title">Zona de peligro</h5>
                                    <p className="muted small">Elimina permanentemente al usuario y su acceso. Esta accion es irreversible.</p>
                                    <button type="button" className="btn btn-bad" disabled={actionLoading === 'delete'} onClick={handleUserDelete}>
                                        {actionLoading === 'delete' ? 'Eliminando...' : 'Eliminar usuario permanentemente'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </Drawer>
        </>
    );
}
