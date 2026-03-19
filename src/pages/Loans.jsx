import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { loanLateFeeOutstanding, loanOutstanding, loanOutstandingWithPenalty, money, formatDate, loanTotalPayable, loanInstallment, loanNextDueDate, loanMaturityDate, initials } from '../utils/helpers';
import { statusTag } from './Dashboard';
import { useDrawer } from '../context/DrawerContext';

export default function Loans() {
    const { state } = useApp();
    const { openDrawer } = useDrawer();
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedLoan, setSelectedLoan] = useState(null);
    const readOnly = ['suspended', 'cancelled'].includes(String(state?.subscription?.status || '').toLowerCase());

    const filteredLoans = state.loans.filter(loan => {
        const customer = state.customers.find(c => c.id === loan.customerId);
        const haystack = `${loan.id} ${loan.type} ${customer ? customer.name : ''}`.toLowerCase();
        const matchesQuery = !query || haystack.includes(query.toLowerCase());
        const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
        return matchesQuery && matchesStatus;
    });

    return (
        <section id="view-loans" className="view">
            <div className="card section-stack">
                <div className="section-head split">
                    <h3>Cartera de prestamos</h3>
                    <div className="topbar-actions">
                        <p className="muted small">{filteredLoans.length} de {state.loans.length} prestamos</p>
                        <button className="btn btn-primary" type="button" onClick={() => openDrawer('loan')} disabled={readOnly}>Nuevo prestamo</button>
                    </div>
                </div>
                <div className="toolbar">
                    <input
                        type="search"
                        placeholder="Buscar por ID, tipo o cliente"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="all">Todos</option>
                        <option value="active">Activos</option>
                        <option value="overdue">Vencidos</option>
                        <option value="paid">Pagados</option>
                    </select>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Cliente</th>
                                <th>Tipo</th>
                                <th>Monto</th>
                                <th>Saldo</th>
                                <th>Estado</th>
                                <th>Accion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLoans.length > 0 ? (
                                filteredLoans.map(loan => {
                                    const customer = state.customers.find(c => c.id === loan.customerId);
                                    return (
                                        <tr key={loan.id} className="motion-item">
                                            <td data-label="ID">{loan.id}</td>
                                            <td data-label="Cliente">{customer ? customer.name : 'Sin cliente'}</td>
                                            <td data-label="Tipo">{loan.type}</td>
                                            <td data-label="Monto">{money(loan.principal)}</td>
                                            <td data-label="Saldo">{money(loanOutstandingWithPenalty(loan, state))}</td>
                                            <td data-label="Estado">{statusTag(loan.status)}</td>
                                            <td data-label="Accion">
                                                <button
                                                    onClick={() => setSelectedLoan(loan)}
                                                    className="action-link"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                                                >
                                                    Detalle
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr className="empty-row">
                                    <td colSpan="7">
                                        <div className="empty-state">
                                            <span className="material-symbols-outlined">{query || statusFilter !== 'all' ? 'search_off' : 'add_card'}</span>
                                            <h4>{query || statusFilter !== 'all' ? 'Sin resultados' : 'Aun no hay prestamos'}</h4>
                                            <p>{query || statusFilter !== 'all' ? 'Ajusta la busqueda o limpia los filtros para ver resultados.' : 'Registra tu primer prestamo para construir la cartera.'}</p>
                                            <button className="btn btn-ghost" type="button" onClick={() => {
                                                if (query || statusFilter !== 'all') {
                                                    setQuery('');
                                                    setStatusFilter('all');
                                                } else {
                                                    openDrawer('loan');
                                                }
                                            }}>
                                                {query || statusFilter !== 'all' ? 'Limpiar filtros' : 'Crear prestamo'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedLoan && (
                <LoanDetailModal
                    loan={selectedLoan}
                    state={state}
                    customer={state.customers.find(c => c.id === selectedLoan.customerId)}
                    payments={state.payments.filter(p => p.loanId === selectedLoan.id)}
                    readOnly={readOnly}
                    onClose={() => setSelectedLoan(null)}
                    onRegisterPayment={() => {
                        setSelectedLoan(null);
                        openDrawer('payment');
                    }}
                />
            )}
        </section>
    );
}

function LoanDetailModal({ loan, state, customer, payments, readOnly, onClose, onRegisterPayment }) {
    const totalPayable = loanTotalPayable(loan);
    const baseOutstanding = loanOutstanding(loan);
    const lateFeeOutstanding = loanLateFeeOutstanding(loan, state);
    const outstanding = loanOutstandingWithPenalty(loan, state);
    const installment = loanInstallment(loan);
    const nextDue = loanNextDueDate(loan);
    const maturity = loanMaturityDate(loan);
    const paidInstallments = Math.floor(loan.paidAmount / installment);
    const progressPercent = loan.termMonths > 0 ? (paidInstallments / loan.termMonths) * 100 : 0;
    const remainingInstallments = Math.max(loan.termMonths - paidInstallments, 0);
    const orderedPayments = [...payments].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="modal-overlay loan-detail-overlay" onClick={onClose}>
            <div className="card loan-detail-modal" onClick={event => event.stopPropagation()}>
                <div className="loan-detail-head">
                    <div className="loan-detail-title-block">
                        <div className="loan-detail-icon">$</div>
                        <div>
                            <p className="eyebrow">Credito en seguimiento</p>
                            <h3>Prestamo #{loan.id}</h3>
                            <div className="loan-detail-meta-row">
                                {statusTag(loan.status)}
                                <span className="role-pill role-admin">{loan.type}</span>
                                <span className="muted small">Inicio {formatDate(loan.startDate)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="loan-detail-head-actions">
                        {loan.status !== 'paid' && (
                            <button type="button" className="btn btn-primary" onClick={onRegisterPayment} disabled={readOnly}>Registrar pago</button>
                        )}
                        <button type="button" className="loan-detail-close" onClick={onClose} aria-label="Cerrar detalle">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                <section className="loan-detail-hero">
                    <div className="loan-hero-balance">
                        <p className="eyebrow">Saldo pendiente total</p>
                        <h2>{money(outstanding)}</h2>
                        <div className="loan-detail-meta-row">
                            <span className="status status-pending">Vence {formatDate(nextDue)}</span>
                            <span className="muted small">Cierre {formatDate(maturity)}</span>
                        </div>
                        {lateFeeOutstanding > 0 && (
                            <p className="muted small">Incluye mora acumulada: {money(lateFeeOutstanding)} · Base: {money(baseOutstanding)}</p>
                        )}
                    </div>

                    <div className="loan-hero-progress">
                        <div className="loan-progress-top">
                            <span className="small muted">Progreso de recuperacion</span>
                            <strong>{progressPercent.toFixed(0)}%</strong>
                        </div>
                        <div className="loan-progress-bar">
                            <div className="loan-progress-fill" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                        </div>
                        <div className="loan-progress-foot">
                            <span>{money(loan.paidAmount)} cobrados</span>
                            <span>{money(totalPayable)} total</span>
                        </div>
                    </div>
                </section>

                <div className="loan-detail-grid">
                    <div className="loan-detail-column">
                        <div className="card section-stack loan-detail-panel">
                            <div className="section-head split">
                                <h4>Cliente</h4>
                                <span className="muted small">Ficha principal</span>
                            </div>

                            {customer ? (
                                <div className="loan-customer-card">
                                    <div className="loan-customer-avatar">{initials(customer.name)}</div>
                                    <div className="cell-stack">
                                        <strong>{customer.name}</strong>
                                        <span className="muted small">{customer.email}</span>
                                        <span className="muted small">{customer.phone}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state compact-empty-state">
                                    <h4>Sin cliente asociado</h4>
                                </div>
                            )}
                        </div>

                        <div className="card section-stack loan-detail-panel">
                            <div className="section-head split">
                                <h4>Cronograma</h4>
                                <span className="muted small">Seguimiento</span>
                            </div>

                            <div className="detail-metrics loan-detail-metrics-tight">
                                <div className="metric">
                                    <p>Proximo vencimiento</p>
                                    <strong>{formatDate(nextDue)}</strong>
                                </div>
                                <div className="metric">
                                    <p>Cierre previsto</p>
                                    <strong>{formatDate(maturity)}</strong>
                                </div>
                                <div className="metric">
                                    <p>Cuotas cubiertas</p>
                                    <strong>{paidInstallments} / {loan.termMonths}</strong>
                                </div>
                                <div className="metric">
                                    <p>Restantes</p>
                                    <strong>{remainingInstallments}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="loan-detail-column">
                        <div className="card section-stack loan-detail-panel loan-detail-panel-strong">
                            <div className="section-head split">
                                <h4>Resumen financiero</h4>
                                <span className="muted small">Credito</span>
                            </div>

                            <div className="loan-financial-grid">
                                <div className="metric loan-metric-highlight">
                                    <p>Monto original</p>
                                    <strong>{money(loan.principal)}</strong>
                                </div>
                                <div className="metric loan-metric-highlight">
                                    <p>Total a recuperar</p>
                                    <strong>{money(totalPayable)}</strong>
                                </div>
                                <div className="metric">
                                    <p>Cuota estimada</p>
                                    <strong>{money(installment)}</strong>
                                </div>
                                <div className="metric">
                                    <p>Tasa</p>
                                    <strong>{loan.interestRate}% {loan.interestRateMode === 'monthly' ? 'mensual' : 'anual'}</strong>
                                </div>
                                <div className="metric">
                                    <p>Plazo</p>
                                    <strong>{loan.termMonths} meses</strong>
                                </div>
                                <div className="metric">
                                    <p>Recuperado</p>
                                    <strong>{money(loan.paidAmount)}</strong>
                                </div>
                                <div className="metric">
                                    <p>Mora actual</p>
                                    <strong>{money(lateFeeOutstanding)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card section-stack loan-detail-panel">
                    <div className="section-head split">
                        <div>
                            <h4>Historial de pagos</h4>
                            <p className="muted">Ultimos movimientos registrados para este credito.</p>
                        </div>
                        <span className="muted small">{payments.length} registro(s)</span>
                    </div>

                    <div className="table-wrap loan-payment-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Monto</th>
                                    <th>Metodo</th>
                                    <th>Nota</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orderedPayments.slice(0, 6).map(payment => (
                                    <tr key={payment.id}>
                                        <td data-label="Fecha">{formatDate(payment.date)}</td>
                                        <td data-label="Monto">{money(payment.amount)}</td>
                                        <td data-label="Metodo">{payment.method}</td>
                                        <td data-label="Nota">{payment.note || 'Sin nota'}</td>
                                    </tr>
                                ))}
                                {payments.length === 0 && (
                                    <tr className="empty-row">
                                        <td colSpan="4">
                                            <div className="empty-state compact-empty-state loan-payment-empty">
                                                <span className="material-symbols-outlined">receipt_long</span>
                                                <h4>Sin pagos registrados</h4>
                                                <p>Este prestamo aun no tiene movimientos aplicados. Puedes registrar el primer pago desde este mismo detalle.</p>
                                                <button type="button" className="btn btn-ghost" onClick={onRegisterPayment}>Registrar pago</button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {payments.length > 6 && (
                        <p className="small muted loan-detail-footnote">Se muestran los 6 pagos mas recientes. Quedan {payments.length - 6} registros adicionales.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
