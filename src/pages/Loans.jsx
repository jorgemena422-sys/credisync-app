import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { loanLateFeeOutstanding, loanOutstanding, loanOutstandingWithPenalty, money, formatDate, loanTotalPayable, loanInstallment, loanNextDueDate, loanMaturityDate, initials, round2 } from '../utils/helpers';
import { statusTag } from './Dashboard';
import { useDrawer } from '../context/DrawerContext';
import { usePortfolioDerivedData } from '../hooks/usePortfolioDerivedData';
import { isStagingRuntimeTarget } from '../utils/runtimeTarget';

export default function Loans() {
    const { state, setState, bootstrapState } = useApp();
    const { openDrawer } = useDrawer();
    const { showToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [editingLoan, setEditingLoan] = useState(null);
    const [updatingLoan, setUpdatingLoan] = useState(false);
    const readOnly = String(state?.subscription?.status || '').toLowerCase() === 'suspended';
    const { customersById } = usePortfolioDerivedData(state);

    const loanComputationState = useMemo(() => ({
        payments: state.payments,
        settings: state.settings
    }), [state.payments, state.settings]);

    const loanRows = useMemo(() => {
        return (state.loans || []).map((loan) => {
            const customer = customersById.get(loan.customerId) || null;
            return {
                loan,
                customer,
                searchKey: `${loan.id} ${loan.type} ${customer ? customer.name : ''}`.toLowerCase(),
                outstanding: loanOutstandingWithPenalty(loan, loanComputationState)
            };
        });
    }, [state.loans, customersById, loanComputationState]);

    const filteredLoanRows = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return loanRows.filter(({ loan, searchKey }) => {
            const matchesQuery = !normalizedQuery || searchKey.includes(normalizedQuery);
            const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [loanRows, query, statusFilter]);

    const selectedLoanCustomer = useMemo(() => {
        if (!selectedLoan) {
            return null;
        }
        return customersById.get(selectedLoan.customerId) || null;
    }, [selectedLoan, customersById]);

    const selectedLoanPayments = useMemo(() => {
        if (!selectedLoan) {
            return [];
        }
        return (state.payments || []).filter((payment) => payment.loanId === selectedLoan.id);
    }, [selectedLoan, state.payments]);

    const deepLinkedLoanId = useMemo(
        () => String(searchParams.get('loanId') || '').trim(),
        [searchParams]
    );

    const requestedStatusFilter = useMemo(
        () => String(searchParams.get('status') || '').trim().toLowerCase(),
        [searchParams]
    );

    const syncLoanSearchParam = useCallback((loanId) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (loanId) {
                next.set('loanId', String(loanId));
            } else {
                next.delete('loanId');
            }
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const openLoanDetail = useCallback((loan) => {
        if (!loan) {
            return;
        }

        setSelectedLoan(loan);
        syncLoanSearchParam(loan.id);
    }, [syncLoanSearchParam]);

    const closeLoanDetail = useCallback(() => {
        setSelectedLoan(null);
        syncLoanSearchParam('');
    }, [syncLoanSearchParam]);

    useEffect(() => {
        if (!deepLinkedLoanId) {
            setSelectedLoan((current) => (current ? null : current));
            return;
        }

        const matchingLoan = (state.loans || []).find((loan) => String(loan.id) === deepLinkedLoanId);
        if (!matchingLoan) {
            return;
        }

        setSelectedLoan((current) => (
            current?.id === matchingLoan.id ? current : matchingLoan
        ));
    }, [deepLinkedLoanId, state.loans]);

    useEffect(() => {
        if (['active', 'overdue', 'paid'].includes(requestedStatusFilter) && requestedStatusFilter !== statusFilter) {
            setStatusFilter(requestedStatusFilter);
        }
    }, [requestedStatusFilter, statusFilter]);

    const handleLoanUpdate = async (payload, originalLoan) => {
        try {
            setUpdatingLoan(true);
            const response = await apiRequest(`/loans/${encodeURIComponent(originalLoan.id)}`, {
                method: 'PUT',
                body: payload
            });

            const updatedLoan = response?.loan || { ...originalLoan, ...payload };
            const nextCustomerId = updatedLoan.customerId || payload.customerId || originalLoan.customerId;

            if (isStagingRuntimeTarget) {
                setState((prev) => ({
                    ...prev,
                    loans: (prev.loans || []).map((loan) => (
                        loan.id === originalLoan.id ? { ...loan, ...updatedLoan } : loan
                    )),
                    payments: (prev.payments || []).map((payment) => (
                        payment.loanId === originalLoan.id
                            ? { ...payment, customerId: nextCustomerId }
                            : payment
                    )),
                    paymentPromises: (prev.paymentPromises || []).map((promise) => (
                        promise.loanId === originalLoan.id
                            ? { ...promise, customerId: nextCustomerId }
                            : promise
                    )),
                    collectionNotes: (prev.collectionNotes || []).map((note) => (
                        note.loanId === originalLoan.id
                            ? { ...note, customerId: nextCustomerId }
                            : note
                    ))
                }));
                bootstrapState({ silent: true }).catch(() => undefined);
            } else {
                await bootstrapState();
            }

            showToast('Prestamo actualizado correctamente');
            setEditingLoan(null);
            setSelectedLoan((current) => (current && current.id === originalLoan.id ? { ...current, ...updatedLoan } : current));
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar el prestamo');
        } finally {
            setUpdatingLoan(false);
        }
    };

    return (
        <section id="view-loans" className="view">
            <div className="card section-stack">
                <div className="section-head split">
                    <h3>Cartera de prestamos</h3>
                    <div className="topbar-actions">
                        <p className="muted small">{filteredLoanRows.length} de {state.loans.length} prestamos</p>
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
                        <option value="active">Al dia</option>
                        <option value="overdue">Atraso</option>
                        <option value="paid">Saldados</option>
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
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLoanRows.length > 0 ? (
                                filteredLoanRows.map(({ loan, customer, outstanding }) => {
                                    return (
                                        <tr
                                            key={loan.id}
                                            className="motion-item"
                                            style={{ cursor: 'pointer' }}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => openLoanDetail(loan)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    openLoanDetail(loan);
                                                }
                                            }}
                                            aria-label={`Abrir detalle del prestamo ${loan.id}`}
                                        >
                                            <td data-label="ID">{loan.id}</td>
                                            <td data-label="Cliente">{customer ? customer.name : 'Sin cliente'}</td>
                                            <td data-label="Tipo">{loan.type}</td>
                                            <td data-label="Monto">{money(loan.principal)}</td>
                                            <td data-label="Saldo">{money(outstanding)}</td>
                                            <td data-label="Estado">{statusTag(loan.status, 'loan')}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr className="empty-row">
                                    <td colSpan="6">
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
                    customer={selectedLoanCustomer}
                    payments={selectedLoanPayments}
                    readOnly={readOnly}
                    onClose={closeLoanDetail}
                    onRegisterPayment={() => {
                        closeLoanDetail();
                        openDrawer('payment');
                    }}
                    onEdit={(loanToEdit) => {
                        closeLoanDetail();
                        setEditingLoan(loanToEdit);
                    }}
                />
            )}

            {editingLoan && (
                <LoanEditModal
                    loan={editingLoan}
                    customers={state.customers || []}
                    payments={state.payments || []}
                    readOnly={readOnly}
                    loading={updatingLoan}
                    onClose={() => setEditingLoan(null)}
                    onSubmit={(payload) => handleLoanUpdate(payload, editingLoan)}
                />
            )}
        </section>
    );
}

function LoanDetailModal({ loan, state, customer, payments, readOnly, onClose, onRegisterPayment, onEdit }) {
    const isInterestOnly = loan.paymentModel === 'interest_only_balloon';
    const totalPayable = loanTotalPayable(loan);
    const baseOutstanding = loanOutstanding(loan);
    const maturityPrincipalDue = isInterestOnly ? Math.max(Number(loan.maturityPrincipalDue || 0), 0) : 0;
    const principalNotDueYet = isInterestOnly ? Math.max(round2(baseOutstanding - maturityPrincipalDue), 0) : 0;
    const interestOutstanding = Math.max(Number(loan.interestOutstanding || 0), 0);
    const interestLateFeeOutstanding = isInterestOnly ? Math.max(Number(loan.interestLateFeeOutstanding || 0), 0) : 0;
    const principalLateFeeOutstanding = isInterestOnly ? Math.max(Number(loan.principalLateFeeOutstanding || 0), 0) : 0;
    const lateFeeOutstanding = loanLateFeeOutstanding(loan, state);
    const outstanding = loanOutstandingWithPenalty(loan, state);
    const totalDueToday = isInterestOnly
        ? round2(maturityPrincipalDue + interestOutstanding + lateFeeOutstanding)
        : outstanding;
    const installment = loanInstallment(loan);
    const nextDue = loanNextDueDate(loan);
    const maturity = loanMaturityDate(loan);
    const periodNumber = isInterestOnly
        ? (() => {
            const start = new Date(`${loan.startDate}T00:00:00`);
            const now = new Date();
            const diffMonths = ((now.getFullYear() - start.getFullYear()) * 12) + (now.getMonth() - start.getMonth()) + 1;
            return Math.max(Math.min(loan.termMonths, diffMonths), 0);
        })()
        : Math.floor(loan.paidAmount / Math.max(installment, 0.01));
    const progressPercent = isInterestOnly
        ? (loan.principal > 0 ? ((loan.principal - baseOutstanding) / loan.principal) * 100 : 0)
        : (loan.termMonths > 0 ? (periodNumber / loan.termMonths) * 100 : 0);
    const remainingPeriods = Math.max(loan.termMonths - periodNumber, 0);
    const orderedPayments = [...payments].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="modal-overlay loan-detail-overlay" onClick={onClose}>
            <div className="card loan-detail-modal loan-summary-modal" onClick={event => event.stopPropagation()}>
                <div className="loan-detail-head">
                    <div className="loan-detail-title-block">
                        <div className="loan-detail-icon">$</div>
                        <div>
                            <p className="eyebrow">Credito en seguimiento</p>
                            <h3>Prestamo #{loan.id}</h3>
                            <div className="loan-detail-meta-row">
                                {statusTag(loan.status, 'loan')}
                                <span className="role-pill role-admin">{loan.type}</span>
                                <span className="muted small">Inicio {formatDate(loan.startDate)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="loan-detail-head-actions">
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
                        {isInterestOnly ? (
                            <div className="cell-stack" style={{ marginTop: '0.35rem' }}>
                                <small className="muted">Exigible hoy: {money(totalDueToday)}</small>
                                <small className="muted">Capital vencido: {money(maturityPrincipalDue)}</small>
                                <small className="muted">Interes vencido: {money(interestOutstanding)}</small>
                                <small className="muted">Mora total: {money(lateFeeOutstanding)} (interes: {money(interestLateFeeOutstanding)} · capital: {money(principalLateFeeOutstanding)})</small>
                                {principalNotDueYet > 0 && <small className="muted">Capital pendiente no vencido: {money(principalNotDueYet)}</small>}
                            </div>
                        ) : lateFeeOutstanding > 0 ? (
                            <p className="muted small">Incluye mora acumulada: {money(lateFeeOutstanding)} · Base: {money(baseOutstanding)}</p>
                        ) : null}
                    </div>

                    <div className="loan-hero-progress">
                        <div className="loan-progress-top">
                            <span className="small muted">{isInterestOnly ? 'Progreso de capital recuperado' : 'Progreso de recuperacion'}</span>
                            <strong>{progressPercent.toFixed(0)}%</strong>
                        </div>
                        <div className="loan-progress-bar">
                            <div className="loan-progress-fill" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                        </div>
                        <div className="loan-progress-foot">
                            <span>{money(loan.paidAmount)} {isInterestOnly ? 'capital recuperado' : 'cobrados'}</span>
                            <span>{money(totalPayable)} {isInterestOnly ? 'capital original' : 'total'}</span>
                        </div>
                    </div>
                </section>

                <div className="card section-stack loan-detail-panel loan-detail-actions-panel">
                    <div className="section-head split">
                        <h4>Acciones del prestamo</h4>
                        <span className="muted small">Gestion directa</span>
                    </div>
                    <div className="action-group-inline">
                        {loan.status !== 'paid' && (
                            <button type="button" className="btn btn-primary" onClick={onRegisterPayment} disabled={readOnly}>Registrar pago</button>
                        )}
                        <button type="button" className="btn btn-bad" onClick={() => onEdit(loan)} disabled={readOnly}>Editar prestamo</button>
                    </div>
                </div>

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
                                    <p>{isInterestOnly ? 'Periodo actual' : 'Cuotas cubiertas'}</p>
                                    <strong>{isInterestOnly ? `${Math.max(periodNumber, 1)} / ${loan.termMonths}` : `${periodNumber} / ${loan.termMonths}`}</strong>
                                </div>
                                <div className="metric">
                                    <p>{isInterestOnly ? 'Periodos restantes' : 'Restantes'}</p>
                                    <strong>{remainingPeriods}</strong>
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
                                    <p>{isInterestOnly ? 'Capital pendiente' : 'Total a recuperar'}</p>
                                    <strong>{money(isInterestOnly ? baseOutstanding : totalPayable)}</strong>
                                </div>
                                <div className="metric">
                                    <p>{isInterestOnly ? 'Interes mensual estimado' : 'Cuota estimada'}</p>
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
                                    <p>{isInterestOnly ? 'Capital recuperado' : 'Recuperado'}</p>
                                    <strong>{money(loan.paidAmount)}</strong>
                                </div>
                                {isInterestOnly && (
                                    <div className="metric">
                                        <p>Capital vencido</p>
                                        <strong>{money(maturityPrincipalDue)}</strong>
                                    </div>
                                )}
                                {isInterestOnly && (
                                    <div className="metric">
                                        <p>Interes vencido</p>
                                        <strong>{money(interestOutstanding)}</strong>
                                    </div>
                                )}
                                {isInterestOnly && (
                                    <div className="metric">
                                        <p>Mora por interes</p>
                                        <strong>{money(interestLateFeeOutstanding)}</strong>
                                    </div>
                                )}
                                {isInterestOnly && (
                                    <div className="metric">
                                        <p>Mora por capital</p>
                                        <strong>{money(principalLateFeeOutstanding)}</strong>
                                    </div>
                                )}
                                <div className="metric">
                                    <p>Mora actual</p>
                                    <strong>{money(lateFeeOutstanding)}</strong>
                                </div>
                                {isInterestOnly && (
                                    <div className="metric loan-metric-highlight">
                                        <p>Total exigible hoy</p>
                                        <strong>{money(totalDueToday)}</strong>
                                    </div>
                                )}
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

function LoanEditModal({ loan, customers, payments, readOnly, loading, onClose, onSubmit }) {
    const [formData, setFormData] = useState(() => ({
        customerId: String(loan.customerId || ''),
        principal: String(loan.principal ?? ''),
        type: String(loan.type || 'personal'),
        paymentModel: String(loan.paymentModel || 'legacy_add_on'),
        interestRateMode: String(loan.interestRateMode || 'annual'),
        interestRate: String(loan.interestRate ?? ''),
        termMonths: String(loan.termMonths ?? ''),
        startDate: String(loan.startDate || '')
    }));

    useEffect(() => {
        setFormData({
            customerId: String(loan.customerId || ''),
            principal: String(loan.principal ?? ''),
            type: String(loan.type || 'personal'),
            paymentModel: String(loan.paymentModel || 'legacy_add_on'),
            interestRateMode: String(loan.interestRateMode || 'annual'),
            interestRate: String(loan.interestRate ?? ''),
            termMonths: String(loan.termMonths ?? ''),
            startDate: String(loan.startDate || '')
        });
    }, [loan]);

    const hasPayments = useMemo(
        () => (payments || []).some((payment) => payment.loanId === loan.id),
        [payments, loan.id]
    );

    const submitEdit = async (event) => {
        event.preventDefault();
        await onSubmit({
            customerId: formData.customerId,
            principal: Number(formData.principal),
            type: formData.type,
            paymentModel: formData.paymentModel,
            interestRateMode: formData.interestRateMode,
            interestRate: Number(formData.interestRate),
            termMonths: Number(formData.termMonths),
            startDate: formData.startDate
        });
    };

    return (
        <div className="modal-overlay loan-detail-overlay" onClick={onClose}>
            <div className="card loan-detail-modal" onClick={(event) => event.stopPropagation()}>
                <div className="loan-detail-head">
                    <div className="loan-detail-title-block">
                        <div className="loan-detail-icon">E</div>
                        <div>
                            <p className="eyebrow">Edicion de credito</p>
                            <h3>Editar prestamo #{loan.id}</h3>
                            <div className="loan-detail-meta-row">
                                <span className="muted small">Actualiza datos base del prestamo</span>
                            </div>
                        </div>
                    </div>

                    <div className="loan-detail-head-actions">
                        <button type="button" className="loan-detail-close" onClick={onClose} aria-label="Cerrar edicion">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                <section className="drawer-panel drawer-section" style={{ marginTop: '0.4rem' }}>
                    <form onSubmit={submitEdit} className="form-grid cols-2">
                        <div className="form-group">
                            <label>Cliente</label>
                            <select
                                required
                                value={formData.customerId}
                                onChange={(event) => setFormData((prev) => ({ ...prev, customerId: event.target.value }))}
                            >
                                <option value="" disabled>Selecciona un cliente</option>
                                {customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Tipo</label>
                            <select
                                required
                                value={formData.type}
                                onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value }))}
                            >
                                <option value="personal">Personal</option>
                                <option value="business">Negocio</option>
                                <option value="mortgage">Hipotecario</option>
                                <option value="auto">Vehicular</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Monto original</label>
                            <input
                                type="number"
                                required
                                min="1"
                                step="0.01"
                                value={formData.principal}
                                onChange={(event) => setFormData((prev) => ({ ...prev, principal: event.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label>Plazo (meses)</label>
                            <input
                                type="number"
                                required
                                min="1"
                                step="1"
                                value={formData.termMonths}
                                onChange={(event) => setFormData((prev) => ({ ...prev, termMonths: event.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label>Tipo de tasa</label>
                            <select
                                value={formData.interestRateMode}
                                onChange={(event) => setFormData((prev) => ({ ...prev, interestRateMode: event.target.value }))}
                            >
                                <option value="annual">Anual</option>
                                <option value="monthly">Mensual</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Tasa de interes (%)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={formData.interestRate}
                                onChange={(event) => setFormData((prev) => ({ ...prev, interestRate: event.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label>Modelo de cobro</label>
                            <select
                                value={formData.paymentModel}
                                onChange={(event) => setFormData((prev) => ({ ...prev, paymentModel: event.target.value }))}
                                disabled={hasPayments}
                            >
                                <option value="interest_only_balloon">Interes mensual + capital al vencimiento</option>
                                <option value="legacy_add_on">Cuota fija (legacy)</option>
                            </select>
                            {hasPayments && (
                                <small className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                                    No puedes cambiar el modelo cuando el prestamo ya tiene pagos registrados.
                                </small>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Fecha de inicio</label>
                            <input
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={(event) => setFormData((prev) => ({ ...prev, startDate: event.target.value }))}
                            />
                        </div>

                        <div className="action-group-inline" style={{ gridColumn: '1 / -1' }}>
                            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                            <button type="submit" className="btn btn-primary" disabled={loading || readOnly}>
                                {loading ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
}
