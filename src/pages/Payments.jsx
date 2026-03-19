import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { daysOverdue, formatDate, isoToday, loanInstallment, loanLateFeeOutstanding, loanNextDueDate, loanOutstandingWithPenalty, money, startOfDay } from '../utils/helpers';
import { useDrawer } from '../context/DrawerContext';

const PROMISE_STATUS_LABELS = {
    pending: 'Pendiente',
    kept: 'Cumplida',
    broken: 'Incumplida',
    cancelled: 'Cancelada'
};

function priorityMeta(item) {
    if (item.overdueDays >= 30) return { label: 'Critica', tone: 'critical' };
    if (item.overdueDays >= 7) return { label: 'Alta', tone: 'high' };
    if (item.overdueDays > 0) return { label: 'Media', tone: 'medium' };
    if (item.daysUntilDue <= 2) return { label: 'Proxima', tone: 'soon' };
    return { label: 'Normal', tone: 'normal' };
}

function monthGap(from, to) {
    return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

function riskMeta(score) {
    if (score >= 80) return { label: 'Critico', tone: 'critical' };
    if (score >= 60) return { label: 'Alto', tone: 'high' };
    if (score >= 35) return { label: 'Medio', tone: 'medium' };
    return { label: 'Controlado', tone: 'normal' };
}

export default function Payments() {
    const { state, bootstrapState } = useApp();
    const { showToast } = useToast();
    const { openDrawer } = useDrawer();

    const [queueFilter, setQueueFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [promiseLoading, setPromiseLoading] = useState(false);
    const [noteLoading, setNoteLoading] = useState(false);
    const [promiseForm, setPromiseForm] = useState({
        loanId: '',
        customerId: '',
        promisedAmount: '',
        promisedDate: isoToday(),
        note: ''
    });
    const [noteForm, setNoteForm] = useState({
        customerId: '',
        loanId: '',
        body: ''
    });
    const readOnly = ['suspended', 'cancelled'].includes(String(state?.subscription?.status || '').toLowerCase());

    const recentPayments = state.payments
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 15);

    const pendingPromises = (state.paymentPromises || [])
        .filter((item) => item.status === 'pending')
        .sort((a, b) => new Date(a.promisedDate) - new Date(b.promisedDate));

    const today = useMemo(() => startOfDay(new Date()), []);

    const collectionQueue = useMemo(() => {
        const promisesByLoan = new Map();
        (state.paymentPromises || []).forEach((promise) => {
            if (!promisesByLoan.has(promise.loanId)) {
                promisesByLoan.set(promise.loanId, []);
            }
            promisesByLoan.get(promise.loanId).push(promise);
        });

        const paymentsByLoan = new Map();
        (state.payments || []).forEach((payment) => {
            if (!paymentsByLoan.has(payment.loanId)) {
                paymentsByLoan.set(payment.loanId, []);
            }
            paymentsByLoan.get(payment.loanId).push(payment);
        });

        const pendingByLoan = new Map();
        pendingPromises.forEach((promise) => {
            const current = pendingByLoan.get(promise.loanId);
            if (!current || new Date(promise.promisedDate) < new Date(current.promisedDate)) {
                pendingByLoan.set(promise.loanId, promise);
            }
        });

        return (state.loans || [])
            .filter((loan) => loan.status !== 'paid')
            .map((loan) => {
                const customer = state.customers.find((item) => item.id === loan.customerId);
                const dueDate = loanNextDueDate(loan);
                const dueDay = dueDate ? startOfDay(dueDate) : null;
                const daysUntilDue = dueDay ? Math.floor((dueDay - today) / 86400000) : 999;
                const overdueDays = daysOverdue(loan, state);
                const lateFeeOutstanding = loanLateFeeOutstanding(loan, state);
                const outstanding = loanOutstandingWithPenalty(loan, state);
                const installment = loanInstallment(loan);
                const pendingPromise = pendingByLoan.get(loan.id) || null;
                const loanPromises = promisesByLoan.get(loan.id) || [];
                const brokenPromises = loanPromises.filter((item) => item.status === 'broken').length;
                const keptPromises = loanPromises.filter((item) => item.status === 'kept').length;
                const unresolvedPromises = loanPromises.filter((item) => item.status === 'pending').length;
                const loanPayments = paymentsByLoan.get(loan.id) || [];

                const startDate = startOfDay(new Date(`${loan.startDate}T00:00:00`));
                const elapsedInstallments = Math.min(loan.termMonths, Math.max(0, monthGap(startDate, today) + 1));
                const paidInstallments = installment > 0 ? Math.min(loan.termMonths, Math.floor((loan.paidAmount || 0) / installment)) : 0;
                const lagInstallments = Math.max(elapsedInstallments - paidInstallments, 0);

                const overdueFactor = Math.min(overdueDays * 2.8, 45);
                const exposureFactor = Math.min(outstanding / 350, 24);
                const lagFactor = Math.min(lagInstallments * 6, 20);
                const historyFactor = Math.min(Math.max((brokenPromises * 10) + (unresolvedPromises * 3) - (keptPromises * 2), 0), 24);
                const lowActivityPenalty = loanPayments.length === 0 ? 4 : 0;
                const riskScore = Math.min(100, Math.round(overdueFactor + exposureFactor + lagFactor + historyFactor + lowActivityPenalty));
                const risk = {
                    score: riskScore,
                    ...riskMeta(riskScore)
                };

                return {
                    loan,
                    customer,
                    dueDate,
                    daysUntilDue,
                    overdueDays,
                    outstanding,
                    lateFeeOutstanding,
                    installment,
                    pendingPromise,
                    priority: priorityMeta({ overdueDays, daysUntilDue }),
                    risk,
                    brokenPromises,
                    lagInstallments
                };
            })
            .sort((a, b) => {
                if (b.risk.score !== a.risk.score) return b.risk.score - a.risk.score;
                if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
                if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue;
                return b.outstanding - a.outstanding;
            });
    }, [state, pendingPromises, today]);

    const queueSummary = useMemo(() => {
        const highRisk = collectionQueue.filter((item) => item.risk.score >= 60).length;
        const overdueCases = collectionQueue.filter((item) => item.overdueDays > 0).length;
        const promisedCases = collectionQueue.filter((item) => item.pendingPromise).length;
        return { highRisk, overdueCases, promisedCases };
    }, [collectionQueue]);

    const filteredQueue = useMemo(() => {
        return collectionQueue.filter((item) => {
            if (queueFilter === 'overdue' && item.overdueDays <= 0) return false;
            if (queueFilter === 'today' && item.daysUntilDue !== 0) return false;
            if (queueFilter === 'week' && (item.daysUntilDue < 0 || item.daysUntilDue > 7)) return false;
            if (queueFilter === 'promised' && !item.pendingPromise) return false;
            if (queueFilter === 'risk-high' && item.risk.score < 60) return false;

            const haystack = `${item.loan.id} ${item.customer?.name || ''} ${item.customer?.email || ''}`.toLowerCase();
            return !search || haystack.includes(search.toLowerCase());
        });
    }, [collectionQueue, queueFilter, search]);

    const customerLoans = useMemo(() => {
        if (!noteForm.customerId) return [];
        return (state.loans || []).filter((loan) => loan.customerId === noteForm.customerId);
    }, [state.loans, noteForm.customerId]);

    const recentNotes = (state.collectionNotes || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

    const handlePromiseLoanChange = (loanId) => {
        const loan = state.loans.find((item) => item.id === loanId);
        if (!loan) {
            setPromiseForm((prev) => ({ ...prev, loanId: '', customerId: '', promisedAmount: '' }));
            return;
        }

        const suggested = Math.min(loanInstallment(loan) + loanLateFeeOutstanding(loan, state), loanOutstandingWithPenalty(loan, state));
        setPromiseForm((prev) => ({
            ...prev,
            loanId,
            customerId: loan.customerId,
            promisedAmount: suggested > 0 ? suggested.toFixed(2) : ''
        }));
    };

    const createPromise = async (event) => {
        event.preventDefault();
        if (readOnly) {
            showToast('Tenant en modo solo lectura. Contacta al superadministrador para reactivar el plan.');
            return;
        }
        try {
            setPromiseLoading(true);
            await apiRequest('/payment-promises', {
                method: 'POST',
                body: {
                    loanId: promiseForm.loanId,
                    customerId: promiseForm.customerId,
                    promisedAmount: Number(promiseForm.promisedAmount),
                    promisedDate: promiseForm.promisedDate,
                    note: promiseForm.note
                }
            });
            setPromiseForm({ loanId: '', customerId: '', promisedAmount: '', promisedDate: isoToday(), note: '' });
            await bootstrapState();
            showToast('Promesa de pago registrada');
        } catch (error) {
            showToast(error.message || 'No se pudo crear la promesa');
        } finally {
            setPromiseLoading(false);
        }
    };

    const updatePromiseStatus = async (promiseId, status) => {
        if (readOnly) {
            showToast('Tenant en modo solo lectura. Contacta al superadministrador para reactivar el plan.');
            return;
        }
        try {
            await apiRequest(`/payment-promises/${promiseId}/status`, {
                method: 'PATCH',
                body: { status }
            });
            await bootstrapState();
            showToast('Estado de promesa actualizado');
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar la promesa');
        }
    };

    const createNote = async (event) => {
        event.preventDefault();
        if (readOnly) {
            showToast('Tenant en modo solo lectura. Contacta al superadministrador para reactivar el plan.');
            return;
        }
        try {
            setNoteLoading(true);
            await apiRequest('/collection-notes', {
                method: 'POST',
                body: {
                    customerId: noteForm.customerId,
                    loanId: noteForm.loanId,
                    body: noteForm.body
                }
            });
            setNoteForm({ customerId: '', loanId: '', body: '' });
            await bootstrapState();
            showToast('Nota guardada');
        } catch (error) {
            showToast(error.message || 'No se pudo guardar la nota');
        } finally {
            setNoteLoading(false);
        }
    };

    return (
        <section id="view-payments" className="view">
            <div className="card section-stack">
                <div className="section-head split">
                    <h3>Cobranza y pagos</h3>
                    <button className="btn btn-primary" type="button" onClick={() => openDrawer('payment')}>Registrar pago</button>
                </div>
                <p className="muted">Gestiona los pagos recientes y registra nuevas cobranzas desde un flujo rapido.</p>
            </div>

            <div className="card section-stack">
                <div className="section-head split">
                    <h3>Bandeja diaria de cobranza</h3>
                    <p className="muted small">{filteredQueue.length} caso(s) priorizados</p>
                </div>

                <div className="payments-risk-strip">
                    <div className="payments-risk-card">
                        <span className="muted small">Riesgo alto/critico</span>
                        <strong>{queueSummary.highRisk}</strong>
                    </div>
                    <div className="payments-risk-card">
                        <span className="muted small">Casos en mora</span>
                        <strong>{queueSummary.overdueCases}</strong>
                    </div>
                    <div className="payments-risk-card">
                        <span className="muted small">Con promesa activa</span>
                        <strong>{queueSummary.promisedCases}</strong>
                    </div>
                </div>

                <div className="payments-queue-toolbar">
                    <input
                        type="search"
                        placeholder="Buscar por cliente o prestamo"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    <select value={queueFilter} onChange={(event) => setQueueFilter(event.target.value)}>
                        <option value="all">Todos</option>
                        <option value="overdue">Vencidos</option>
                        <option value="today">Vencen hoy</option>
                        <option value="week">Proximos 7 dias</option>
                        <option value="promised">Con promesa pendiente</option>
                        <option value="risk-high">Riesgo alto</option>
                    </select>
                </div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Prestamo</th>
                                <th>Vencimiento</th>
                                <th>Cuota estimada</th>
                                <th>Saldo</th>
                                <th>Riesgo</th>
                                <th>Prioridad</th>
                                <th>Promesa</th>
                                <th>Accion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredQueue.length > 0 ? (
                                filteredQueue.map((item) => (
                                    <tr key={item.loan.id} className="motion-item">
                                        <td data-label="Cliente">{item.customer ? item.customer.name : 'Sin cliente'}</td>
                                        <td data-label="Prestamo">{item.loan.id}</td>
                                        <td data-label="Vencimiento">
                                            <div className="cell-stack">
                                                <strong>{formatDate(item.dueDate)}</strong>
                                                <span className="muted small">
                                                    {item.overdueDays > 0
                                                        ? `${item.overdueDays} dia(s) en mora`
                                                        : item.daysUntilDue === 0
                                                            ? 'Vence hoy'
                                                            : `Faltan ${item.daysUntilDue} dia(s)`}
                                                </span>
                                            </div>
                                        </td>
                                        <td data-label="Cuota estimada">{money(Math.min(item.installment + item.lateFeeOutstanding, item.outstanding))}</td>
                                        <td data-label="Saldo">
                                            <div className="cell-stack">
                                                <strong>{money(item.outstanding)}</strong>
                                                {item.lateFeeOutstanding > 0 && <small className="muted">Mora: {money(item.lateFeeOutstanding)}</small>}
                                            </div>
                                        </td>
                                        <td data-label="Riesgo">
                                            <div className="cell-stack">
                                                <strong>{item.risk.score}/100</strong>
                                                <span className={`status queue-risk queue-risk-${item.risk.tone}`}>{item.risk.label}</span>
                                                {item.lagInstallments > 0 && (
                                                    <small className="muted">Atraso: {item.lagInstallments} cuota(s)</small>
                                                )}
                                            </div>
                                        </td>
                                        <td data-label="Prioridad">
                                            <span className={`status queue-priority queue-priority-${item.priority.tone}`}>{item.priority.label}</span>
                                        </td>
                                        <td data-label="Promesa">
                                            <div className="cell-stack">
                                                <span>
                                                    {item.pendingPromise
                                                        ? `${formatDate(item.pendingPromise.promisedDate)} · ${money(item.pendingPromise.promisedAmount)}`
                                                        : 'Sin promesa'}
                                                </span>
                                                {item.brokenPromises > 0 && (
                                                    <small className="muted">{item.brokenPromises} incumplida(s)</small>
                                                )}
                                            </div>
                                        </td>
                                        <td data-label="Accion">
                                            <button className="btn btn-ghost" type="button" onClick={() => openDrawer('payment')}>
                                                Cobrar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr className="empty-row">
                                    <td colSpan="9">
                                        <div className="empty-state compact-empty-state">
                                            <span className="material-symbols-outlined">inbox</span>
                                            <h4>Sin casos para el filtro actual</h4>
                                            <p>Ajusta filtros o busca por otro cliente para revisar la cartera.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="payments-grid">
                <div className="card section-stack">
                    <div className="section-head split">
                        <h3>Promesas de pago</h3>
                        <span className="muted small">{pendingPromises.length} pendiente(s)</span>
                    </div>

                    <form className="form-grid" onSubmit={createPromise}>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Prestamo</label>
                            <select
                                required
                                value={promiseForm.loanId}
                                onChange={(event) => handlePromiseLoanChange(event.target.value)}
                            >
                                <option value="" disabled>Selecciona un prestamo activo</option>
                                {state.loans.filter((loan) => loan.status !== 'paid').map((loan) => {
                                    const customer = state.customers.find((entry) => entry.id === loan.customerId);
                                    return (
                                        <option key={loan.id} value={loan.id}>
                                            {loan.id} - {customer ? customer.name : 'Sin cliente'}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Monto prometido</label>
                            <input
                                required
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={promiseForm.promisedAmount}
                                onChange={(event) => setPromiseForm((prev) => ({ ...prev, promisedAmount: event.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Fecha compromiso</label>
                            <input
                                required
                                type="date"
                                value={promiseForm.promisedDate}
                                onChange={(event) => setPromiseForm((prev) => ({ ...prev, promisedDate: event.target.value }))}
                            />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Nota</label>
                            <input
                                type="text"
                                placeholder="Detalle de la gestion"
                                value={promiseForm.note}
                                onChange={(event) => setPromiseForm((prev) => ({ ...prev, note: event.target.value }))}
                            />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <button className="btn btn-primary" type="submit" disabled={promiseLoading || readOnly}>
                                {promiseLoading ? 'Guardando...' : 'Registrar promesa'}
                            </button>
                        </div>
                    </form>

                    <div className="payments-list">
                        {(state.paymentPromises || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8).map((promise) => {
                            const customer = state.customers.find((entry) => entry.id === promise.customerId);
                            return (
                                <div key={promise.id} className="payments-list-item">
                                    <div>
                                        <strong>{customer ? customer.name : promise.customerId}</strong>
                                        <p className="muted small">{promise.loanId} · {formatDate(promise.promisedDate)} · {money(promise.promisedAmount)}</p>
                                    </div>
                                    <div className="payments-list-actions">
                                        <span className={`status status-${promise.status === 'kept' ? 'active' : promise.status === 'broken' ? 'overdue' : 'pending'}`}>
                                            {PROMISE_STATUS_LABELS[promise.status] || promise.status}
                                        </span>
                                        {promise.status === 'pending' && (
                                            <>
                                                <button type="button" className="btn btn-ghost" onClick={() => updatePromiseStatus(promise.id, 'kept')} disabled={readOnly}>Cumplida</button>
                                                <button type="button" className="btn btn-ghost" onClick={() => updatePromiseStatus(promise.id, 'broken')} disabled={readOnly}>Incumplida</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {(state.paymentPromises || []).length === 0 && (
                            <div className="empty-state compact-empty-state">
                                <h4>Sin promesas registradas</h4>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card section-stack">
                    <div className="section-head split">
                        <h3>Notas internas de cobranza</h3>
                        <span className="muted small">{recentNotes.length} reciente(s)</span>
                    </div>

                    <form className="form-grid" onSubmit={createNote}>
                        <div className="form-group">
                            <label>Cliente</label>
                            <select
                                required
                                value={noteForm.customerId}
                                onChange={(event) => setNoteForm({ customerId: event.target.value, loanId: '', body: noteForm.body })}
                            >
                                <option value="" disabled>Selecciona un cliente</option>
                                {state.customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Prestamo (opcional)</label>
                            <select
                                value={noteForm.loanId}
                                onChange={(event) => setNoteForm((prev) => ({ ...prev, loanId: event.target.value }))}
                                disabled={!noteForm.customerId}
                            >
                                <option value="">Sin prestamo</option>
                                {customerLoans.map((loan) => (
                                    <option key={loan.id} value={loan.id}>{loan.id}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Nota</label>
                            <textarea
                                required
                                rows={3}
                                maxLength={1200}
                                placeholder="Ej. Cliente confirma abono parcial el viernes"
                                value={noteForm.body}
                                onChange={(event) => setNoteForm((prev) => ({ ...prev, body: event.target.value }))}
                            />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <button className="btn btn-primary" type="submit" disabled={noteLoading || readOnly}>
                                {noteLoading ? 'Guardando...' : 'Guardar nota'}
                            </button>
                        </div>
                    </form>

                    <div className="payments-list">
                        {recentNotes.map((entry) => {
                            const customer = state.customers.find((item) => item.id === entry.customerId);
                            return (
                                <div key={entry.id} className="payments-list-item payments-note-item">
                                    <div>
                                        <strong>{customer ? customer.name : entry.customerId}</strong>
                                        <p>{entry.body}</p>
                                        <span className="muted small">{entry.loanId ? `${entry.loanId} · ` : ''}{formatDate(entry.createdAt)}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {recentNotes.length === 0 && (
                            <div className="empty-state compact-empty-state">
                                <h4>No hay notas registradas</h4>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="card section-stack">
                <div className="section-head"><h3>Pagos recientes</h3></div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Cliente</th>
                                <th>Prestamo</th>
                                <th>Metodo</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentPayments.length > 0 ? (
                                recentPayments.map(payment => {
                                    const customer = state.customers.find(c => c.id === payment.customerId);
                                    return (
                                        <tr key={`${payment.loanId}-${payment.date}-${payment.amount}`} className="motion-item">
                                            <td data-label="Fecha">{formatDate(payment.date)}</td>
                                            <td data-label="Cliente">{customer ? customer.name : 'Sin cliente'}</td>
                                            <td data-label="Prestamo">{payment.loanId}</td>
                                            <td data-label="Metodo">{payment.method}</td>
                                            <td data-label="Monto">{money(payment.amount)}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr className="empty-row">
                                    <td colSpan="5">
                                        <div className="empty-state">
                                            <span className="material-symbols-outlined">payments</span>
                                            <h4>No hay pagos registrados</h4>
                                            <p>Los pagos aplicados a la cartera apareceran aqui.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
