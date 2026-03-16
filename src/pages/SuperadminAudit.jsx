import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../utils/api';
import { formatDate, money } from '../utils/helpers';
import { statusTag } from './Dashboard';

function AuditMetric({ label, value }) {
    return (
        <div className="metric">
            <p>{label}</p>
            <strong>{value}</strong>
        </div>
    );
}

export default function SuperadminAudit() {
    const { tenantId } = useParams();
    const { showToast } = useToast();
    const [auditData, setAuditData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAuditData = async () => {
            try {
                setLoading(true);
                const res = await apiRequest(`/superadmin/tenants/${tenantId}/audit`);
                setAuditData(res);
            } catch (error) {
                setAuditData(null);
                showToast(error.message || 'Error al auditar tenant');
            } finally {
                setLoading(false);
            }
        };

        fetchAuditData();
    }, [tenantId, showToast]);

    const metrics = useMemo(() => {
        const state = auditData?.state;
        if (!state) return null;

        const totalLent = state.loans.reduce((acc, loan) => acc + Number(loan.principal || 0), 0);
        const totalPayments = state.payments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0);

        return {
            users: state.users.length,
            customers: state.customers.length,
            loans: state.loans.length,
            payments: state.payments.length,
            capitalBudget: money(state.settings?.capitalBudget || 0),
            totalLent: money(totalLent),
            totalPayments: money(totalPayments)
        };
    }, [auditData]);

    if (loading) {
        return <section className="view"><div className="empty-state"><span className="material-symbols-outlined">hourglass_top</span><h4>Cargando auditoria...</h4></div></section>;
    }

    if (!auditData) {
        return <section className="view"><div className="empty-state"><span className="material-symbols-outlined">database_off</span><h4>Informacion no disponible</h4></div></section>;
    }

    const { tenant, user, state } = auditData;

    return (
        <section className="view">
            <div className="card section-stack audit-head">
                <div className="section-head split">
                    <div>
                        <h3>Auditoria del tenant</h3>
                        <p className="muted">Revision operativa y de configuracion para <strong>{tenant?.name || tenantId}</strong>.</p>
                        <div className="superadmin-inline-meta">
                            {tenant?.status && statusTag(tenant.status)}
                            {user?.role && <span className="role-pill role-admin">{user.role}</span>}
                            <span className="status status-inactive"><code>{tenantId}</code></span>
                        </div>
                    </div>
                    <Link to="/superadmin/audit" className="btn btn-ghost">Volver</Link>
                </div>
            </div>

            {metrics && (
                <div className="card section-stack">
                    <div className="detail-metrics">
                        <AuditMetric label="Usuarios" value={metrics.users} />
                        <AuditMetric label="Clientes" value={metrics.customers} />
                        <AuditMetric label="Prestamos" value={metrics.loans} />
                        <AuditMetric label="Pagos" value={metrics.payments} />
                        <AuditMetric label="Capital budget" value={metrics.capitalBudget} />
                        <AuditMetric label="Capital colocado" value={metrics.totalLent} />
                    </div>
                </div>
            )}

            <div className="detail-grid audit-grid">
                <div className="card section-stack">
                    <div className="section-head split">
                        <div>
                            <h4>Usuarios del tenant</h4>
                            <p className="muted">Cuentas internas y ultimo acceso registrado.</p>
                        </div>
                        <span className="muted small">{state.users.length} usuario(s)</span>
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Correo</th>
                                    <th>Rol</th>
                                    <th>Estado</th>
                                    <th>Ultimo acceso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {state.users.length > 0 ? state.users.map((item) => (
                                    <tr key={item.id}>
                                        <td data-label="Nombre">{item.name || '-'}</td>
                                        <td data-label="Correo">{item.email}</td>
                                        <td data-label="Rol">{item.role}</td>
                                        <td data-label="Estado">{statusTag(item.status)}</td>
                                        <td data-label="Ultimo acceso">{formatDate(item.lastLoginAt)}</td>
                                    </tr>
                                )) : (
                                    <tr className="empty-row"><td colSpan="5"><div className="empty-state compact-empty-state"><h4>Sin usuarios</h4></div></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card section-stack">
                    <div className="section-head">
                        <h4>Configuracion</h4>
                    </div>
                    <div className="superadmin-list">
                        <div className="superadmin-list-item"><span className="muted small">Plan</span><strong>{state.subscription?.planName || '-'}</strong></div>
                        <div className="superadmin-list-item"><span className="muted small">Suscripcion</span><strong>{state.subscription?.status || '-'}</strong></div>
                        <div className="superadmin-list-item"><span className="muted small">Tasa personal</span><strong>{state.settings.personalLoanRate}%</strong></div>
                        <div className="superadmin-list-item"><span className="muted small">Tasa negocio</span><strong>{state.settings.businessLoanRate}%</strong></div>
                        <div className="superadmin-list-item"><span className="muted small">Dias de gracia</span><strong>{state.settings.graceDays}</strong></div>
                        <div className="superadmin-list-item"><span className="muted small">Score autoaprobacion</span><strong>{state.settings.autoApprovalScore}</strong></div>
                        <div className="superadmin-list-item"><span className="muted small">Max deuda / ingreso</span><strong>{state.settings.maxDebtToIncome}%</strong></div>
                        <div className="superadmin-list-item"><span className="muted small">Capital budget</span><strong>{money(state.settings.capitalBudget || 0)}</strong></div>
                    </div>
                </div>
            </div>

            <div className="detail-grid audit-grid">
                <div className="card section-stack">
                    <div className="section-head split">
                        <div>
                            <h4>Clientes recientes</h4>
                            <p className="muted">Ultimos registros del tenant.</p>
                        </div>
                        <span className="muted small">{state.customers.length} cliente(s)</span>
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Correo</th>
                                    <th>Telefono</th>
                                    <th>Alta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {state.customers.length > 0 ? state.customers.slice(0, 12).map((customer) => (
                                    <tr key={customer.id}>
                                        <td data-label="Nombre">{customer.name}</td>
                                        <td data-label="Correo">{customer.email}</td>
                                        <td data-label="Telefono">{customer.phone}</td>
                                        <td data-label="Alta">{formatDate(customer.joinedAt)}</td>
                                    </tr>
                                )) : (
                                    <tr className="empty-row"><td colSpan="4"><div className="empty-state compact-empty-state"><h4>Sin clientes</h4></div></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card section-stack">
                    <div className="section-head split">
                        <div>
                            <h4>Pagos recientes</h4>
                            <p className="muted">Ultima actividad financiera registrada.</p>
                        </div>
                        <span className="muted small">{state.payments.length} pago(s)</span>
                    </div>
                    <div className="superadmin-list">
                        {state.payments.length > 0 ? state.payments.slice(0, 8).map((payment) => (
                            <div key={payment.id} className="superadmin-list-item stack-item">
                                <div>
                                    <span className="muted small">{formatDate(payment.date)}</span>
                                    <strong>{money(payment.amount)}</strong>
                                </div>
                                <span className="status status-paid">{payment.method || 'Pago'}</span>
                            </div>
                        )) : <div className="empty-state compact-empty-state"><h4>Sin pagos</h4></div>}
                    </div>
                </div>
            </div>

            <div className="card section-stack">
                <div className="section-head split">
                    <div>
                        <h4>Prestamos</h4>
                        <p className="muted">Resumen de cartera del tenant.</p>
                    </div>
                    <span className="muted small">{state.loans.length} prestamo(s)</span>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tipo</th>
                                <th>Monto</th>
                                <th>Inicio</th>
                                <th>Pagado</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {state.loans.length > 0 ? state.loans.slice(0, 15).map((loan) => (
                                <tr key={loan.id}>
                                    <td data-label="ID">{loan.id}</td>
                                    <td data-label="Tipo">{loan.type}</td>
                                    <td data-label="Monto">{money(loan.principal)}</td>
                                    <td data-label="Inicio">{formatDate(loan.startDate)}</td>
                                    <td data-label="Pagado">{money(loan.paidAmount)}</td>
                                    <td data-label="Estado">{statusTag(loan.status)}</td>
                                </tr>
                            )) : (
                                <tr className="empty-row"><td colSpan="6"><div className="empty-state compact-empty-state"><h4>Sin prestamos</h4></div></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
