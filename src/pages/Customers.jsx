import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { money, initials, formatDate, sum, loanOutstanding, customerRiskProfile } from '../utils/helpers';
import { useDrawer } from '../context/DrawerContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../utils/api';
import { statusTag } from './Dashboard';

export default function Customers() {
    const { state, bootstrapState } = useApp();
    const { openDrawer } = useDrawer();
    const { showToast } = useToast();
    const [query, setQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [deletingCustomerId, setDeletingCustomerId] = useState('');
    const readOnly = ['suspended', 'cancelled'].includes(String(state?.subscription?.status || '').toLowerCase());

    const filteredCustomers = state.customers.filter(customer => {
        const haystack = `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase();
        return !query || haystack.includes(query.toLowerCase());
    });

    const handleDeleteCustomer = async (customer) => {
        if (!customer || readOnly || deletingCustomerId) {
            return;
        }

        const customerLoans = state.loans.filter((loan) => loan.customerId === customer.id);
        const activeLoans = customerLoans.filter((loan) => loan.status === 'active' || loan.status === 'overdue').length;
        const warning = [
            `Vas a eliminar al cliente ${customer.name}.`,
            'Esta accion eliminara tambien prestamos, pagos y promesas asociados a este cliente.',
            activeLoans > 0 ? `Tiene ${activeLoans} prestamo(s) activo(s).` : null,
            'Esta accion no se puede deshacer.'
        ].filter(Boolean).join('\n\n');

        if (!window.confirm(warning)) {
            return;
        }

        try {
            setDeletingCustomerId(customer.id);
            await apiRequest(`/customers/${customer.id}`, {
                method: 'DELETE'
            });
            if (selectedCustomer?.id === customer.id) {
                setSelectedCustomer(null);
            }
            await bootstrapState();
            showToast('Cliente eliminado exitosamente');
        } catch (error) {
            showToast(error.message || 'No se pudo eliminar el cliente');
        } finally {
            setDeletingCustomerId('');
        }
    };

    return (
        <section id="view-customers" className="view">
            <div className="card section-stack">
                <div className="section-head split">
                    <h3>Directorio de clientes</h3>
                    <button className="btn btn-primary" type="button" onClick={() => openDrawer('customer')} disabled={readOnly}>Nuevo cliente</button>
                </div>
                <div className="toolbar single">
                    <input
                        type="search"
                        placeholder="Buscar cliente por nombre, correo o telefono"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>
                <div className="table-wrap customers-table-wrap">
                    <table className="customers-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Contacto</th>
                                <th>Prestamos activos</th>
                                <th>Total prestado</th>
                                <th>Accion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.length > 0 ? (
                                filteredCustomers.map(customer => {
                                    const customerLoans = state.loans.filter(l => l.customerId === customer.id);
                                    const activeCount = customerLoans.filter(l => l.status === 'active' || l.status === 'overdue').length;
                                    const totalLent = customerLoans.reduce((sumAmount, l) => sumAmount + l.principal, 0);

                                    return (
                                        <tr
                                            key={customer.id}
                                            className="motion-item customer-row-clickable"
                                            onClick={() => setSelectedCustomer(customer)}
                                        >
                                            <td data-label="Cliente">
                                                <strong>{customer.name}</strong><br />
                                                <small className="muted">{customer.id}</small>
                                            </td>
                                            <td data-label="Contacto">
                                                {customer.email}<br />
                                                {customer.phone}
                                            </td>
                                            <td data-label="Prestamos activos">{activeCount}</td>
                                            <td data-label="Total prestado">{money(totalLent)}</td>
                                            <td data-label="Accion">
                                                <div className="action-group-inline">
                                                    <button
                                                        type="button"
                                                        className="action-link"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setSelectedCustomer(customer);
                                                        }}
                                                    >
                                                        Ver detalle
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr className="empty-row">
                                    <td colSpan="5">
                                        <div className="empty-state">
                                            <span className="material-symbols-outlined">{query ? 'person_search' : 'group_add'}</span>
                                            <h4>{query ? 'Ningun cliente coincide' : 'Aun no hay clientes'}</h4>
                                            <p>{query ? 'Intenta usar otros terminos de busqueda.' : 'Registra clientes para asociarles prestamos.'}</p>
                                            {query && (
                                                <button className="btn btn-ghost" type="button" onClick={() => setQuery('')}>Limpiar busqueda</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedCustomer && (
                <CustomerDetailModal
                    customer={selectedCustomer}
                    loans={state.loans.filter((loan) => loan.customerId === selectedCustomer.id)}
                    payments={state.payments.filter((payment) => payment.customerId === selectedCustomer.id)}
                    paymentPromises={(state.paymentPromises || []).filter((promise) => promise.customerId === selectedCustomer.id)}
                    fullState={state}
                    readOnly={readOnly}
                    deletingCustomerId={deletingCustomerId}
                    onClose={() => setSelectedCustomer(null)}
                    onCreateLoan={() => {
                        setSelectedCustomer(null);
                        openDrawer('loan');
                    }}
                    onDeleteCustomer={handleDeleteCustomer}
                />
            )}
        </section>
    );
}

function CustomerDetailModal({
    customer,
    loans,
    payments,
    paymentPromises,
    fullState,
    readOnly,
    deletingCustomerId,
    onClose,
    onCreateLoan,
    onDeleteCustomer
}) {
    const activeLoans = loans.filter((loan) => loan.status === 'active' || loan.status === 'overdue');
    const totalLent = sum(loans, (loan) => loan.principal || 0);
    const totalCollected = sum(payments, (payment) => payment.amount || 0);
    const outstanding = sum(activeLoans, (loan) => loanOutstanding(loan));
    const risk = customerRiskProfile(customer.id, fullState);
    const latestLoan = [...loans].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))[0] || null;
    const recentPayments = [...payments].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return (
        <div className="modal-overlay loan-detail-overlay" onClick={onClose}>
            <div className="card loan-detail-modal customer-detail-modal" onClick={(event) => event.stopPropagation()}>
                <div className="loan-detail-head">
                    <div className="loan-detail-title-block">
                        <div className="loan-detail-icon customer-detail-icon">{initials(customer.name)}</div>
                        <div>
                            <p className="eyebrow">Perfil financiero</p>
                            <h3>{customer.name}</h3>
                            <div className="loan-detail-meta-row">
                                <span className="role-pill role-admin">Cliente</span>
                                <span className={`status queue-risk queue-risk-${risk.tone}`}>Riesgo {risk.level}</span>
                                <span className="muted small">Alta {formatDate(customer.joinedAt)}</span>
                                <span className="muted small">ID {customer.id}</span>
                            </div>
                        </div>
                    </div>

                    <div className="loan-detail-head-actions">
                        <button type="button" className="loan-detail-close" onClick={onClose} aria-label="Cerrar detalle">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                <section className="loan-detail-hero customer-detail-hero">
                    <div className="loan-hero-balance customer-hero-main">
                        <p className="eyebrow">Exposicion vigente</p>
                        <h2>{money(outstanding)}</h2>
                        <div className="loan-detail-meta-row">
                            <span className="status status-active">{activeLoans.length} credito(s) activo(s)</span>
                            <span className="muted small">Cobrado {money(totalCollected)}</span>
                        </div>
                    </div>

                    <div className="loan-hero-progress customer-contact-card">
                        <div className="section-head split">
                            <h4>Contacto</h4>
                            <span className="muted small">Canales</span>
                        </div>
                        <div className="compact-list" style={{ display: 'grid', gap: '0.75rem' }}>
                            <div className="superadmin-list-item stack-item" style={{ margin: 0 }}>
                                <div>
                                    <span className="muted small">Correo</span>
                                    <strong>{customer.email}</strong>
                                </div>
                            </div>
                            <div className="superadmin-list-item stack-item" style={{ margin: 0 }}>
                                <div>
                                    <span className="muted small">Telefono</span>
                                    <strong>{customer.phone}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="card section-stack loan-detail-panel customer-detail-actions">
                    <div className="section-head split">
                        <h4>Acciones del cliente</h4>
                        <span className="muted small">Gestion directa</span>
                    </div>
                    <div className="action-group-inline">
                        <button type="button" className="btn btn-primary" onClick={onCreateLoan}>Nuevo prestamo</button>
                        <button
                            type="button"
                            className="btn btn-bad"
                            onClick={() => onDeleteCustomer(customer)}
                            disabled={readOnly || deletingCustomerId === customer.id}
                        >
                            {deletingCustomerId === customer.id ? 'Eliminando...' : 'Eliminar cliente'}
                        </button>
                    </div>
                </div>

                <div className="loan-detail-grid">
                    <div className="loan-detail-column">
                        <div className="card section-stack loan-detail-panel customer-risk-card">
                            <div className="section-head split">
                                <h4>Nivel de riesgo</h4>
                                <span className={`status queue-risk queue-risk-${risk.tone}`}>{risk.level}</span>
                            </div>

                            <div className="customer-risk-grid">
                                <div className="metric loan-metric-highlight">
                                    <p>Score de riesgo</p>
                                    <strong>{risk.score}/100</strong>
                                </div>
                                <div className="metric">
                                    <p>Puntos ganados</p>
                                    <strong>+{risk.pointsEarned}</strong>
                                </div>
                                <div className="metric">
                                    <p>Penalizaciones</p>
                                    <strong>-{risk.pointsLost}</strong>
                                </div>
                                <div className="metric">
                                    <p>Pagos puntuales</p>
                                    <strong>{risk.onTimeInstallments}</strong>
                                </div>
                                <div className="metric">
                                    <p>Pagos tardios</p>
                                    <strong>{risk.lateInstallments}</strong>
                                </div>
                                <div className="metric">
                                    <p>Mora maxima</p>
                                    <strong>{risk.overdueDaysMax} dia(s)</strong>
                                </div>
                                <div className="metric">
                                    <p>Promesas incumplidas</p>
                                    <strong>{risk.brokenPromises}</strong>
                                </div>
                            </div>

                            <div className="customer-risk-list">
                                <span className="muted small">Promesas: {paymentPromises.length} total · {risk.pendingPromises} pendiente(s) · {risk.keptPromises} cumplida(s) · {risk.brokenPromises} incumplida(s)</span>
                                <span className="muted small">Exposicion vigente: {money(risk.outstanding)} en {risk.activeLoans} credito(s) activo(s)</span>
                                <span className="muted small">Atraso operativo: {risk.lagInstallments} cuota(s) · Mora acumulada {risk.overdueDaysTotal} dia(s)</span>
                            </div>
                        </div>

                        <div className="card section-stack loan-detail-panel">
                            <div className="section-head split">
                                <h4>Resumen del cliente</h4>
                                <span className="muted small">Relacion comercial</span>
                            </div>

                            <div className="loan-financial-grid">
                                <div className="metric">
                                    <p>Total prestado</p>
                                    <strong>{money(totalLent)}</strong>
                                </div>
                                <div className="metric">
                                    <p>Total cobrado</p>
                                    <strong>{money(totalCollected)}</strong>
                                </div>
                                <div className="metric">
                                    <p>Prestamos activos</p>
                                    <strong>{activeLoans.length}</strong>
                                </div>
                                <div className="metric">
                                    <p>Historicos</p>
                                    <strong>{loans.length}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="card section-stack loan-detail-panel">
                            <div className="section-head split">
                                <h4>Ultimo credito</h4>
                                <span className="muted small">Referencia reciente</span>
                            </div>

                            {latestLoan ? (
                                <div className="loan-customer-card">
                                    <div className="cell-stack">
                                        <strong>{latestLoan.id}</strong>
                                        <span className="muted small">Inicio {formatDate(latestLoan.startDate)}</span>
                                        <div className="loan-detail-meta-row">
                                            {statusTag(latestLoan.status, 'loan')}
                                            <span className="role-pill role-admin">{latestLoan.type}</span>
                                        </div>
                                    </div>
                                    <div className="cell-stack align-end">
                                        <strong>{money(latestLoan.principal)}</strong>
                                        <span className="muted small">Saldo {money(loanOutstanding(latestLoan))}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state compact-empty-state">
                                    <h4>Sin prestamos registrados</h4>
                                    <p>Este cliente aun no tiene historial crediticio en la plataforma.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="loan-detail-column">
                        <div className="card section-stack loan-detail-panel loan-detail-panel-strong">
                            <div className="section-head split">
                                <h4>Cartera del cliente</h4>
                                <span className="muted small">Creditos asociados</span>
                            </div>

                            <div className="table-wrap loan-payment-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Tipo</th>
                                            <th>Monto</th>
                                            <th>Saldo</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loans.length > 0 ? loans.slice().sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)).slice(0, 6).map((loan) => (
                                            <tr key={loan.id}>
                                                <td data-label="ID">{loan.id}</td>
                                                <td data-label="Tipo">{loan.type}</td>
                                                <td data-label="Monto">{money(loan.principal)}</td>
                                                <td data-label="Saldo">{money(loanOutstanding(loan))}</td>
                                                <td data-label="Estado">{statusTag(loan.status, 'loan')}</td>
                                            </tr>
                                        )) : (
                                            <tr className="empty-row">
                                                <td colSpan="5">
                                                    <div className="empty-state compact-empty-state">
                                                        <span className="material-symbols-outlined">credit_card_off</span>
                                                        <h4>Sin prestamos</h4>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card section-stack loan-detail-panel">
                    <div className="section-head split">
                        <div>
                            <h4>Pagos recientes</h4>
                            <p className="muted">Historial de recaudo asociado a este cliente.</p>
                        </div>
                        <span className="muted small">{payments.length} pago(s)</span>
                    </div>

                    <div className="table-wrap loan-payment-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Monto</th>
                                    <th>Metodo</th>
                                    <th>Prestamo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentPayments.slice(0, 6).map((payment) => (
                                    <tr key={payment.id}>
                                        <td data-label="Fecha">{formatDate(payment.date)}</td>
                                        <td data-label="Monto">{money(payment.amount)}</td>
                                        <td data-label="Metodo">{payment.method}</td>
                                        <td data-label="Prestamo">{payment.loanId}</td>
                                    </tr>
                                ))}
                                {payments.length === 0 && (
                                    <tr className="empty-row">
                                        <td colSpan="4">
                                            <div className="empty-state compact-empty-state loan-payment-empty">
                                                <span className="material-symbols-outlined">payments</span>
                                                <h4>Sin pagos registrados</h4>
                                                <p>Aun no hay recaudos asociados a este cliente. Crea un prestamo o registra un pago para iniciar el historial.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
