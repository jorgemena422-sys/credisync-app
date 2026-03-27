import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { money, loanNextDueDate, loanPendingInstallments, loanOutstanding, loanInstallment, capitalBudget, capitalCommittedFromLoans, capitalAvailable, capitalUsagePct, sum, formatDate, paymentBreakdown, nameFromEmail, startOfDay, loanLateFeePaid, round2, loanTotalPayable, isInterestOnlyBalloonLoan } from '../utils/helpers';
import { Link } from 'react-router-dom';
import { useDrawer } from '../context/DrawerContext';
import { usePortfolioDerivedData } from '../hooks/usePortfolioDerivedData';

export function statusTag(status, scope = 'default') {
    const normalizedStatus = String(status || '').toLowerCase();
    const defaultMap = {
        active: 'Activo',
        inactive: 'Inactivo',
        suspended: 'Suspendido',
        pending: 'Pendiente',
        overdue: 'Vencido',
        paid: 'Pagado'
    };
    const loanMap = {
        ...defaultMap,
        active: 'Al dia',
        pending: 'Atraso',
        overdue: 'Atraso',
        paid: 'Saldado'
    };
    const map = scope === 'loan' ? loanMap : defaultMap;
    return <span className={`status status-${normalizedStatus}`}>{map[normalizedStatus] || '-'}</span>;
}

function kpiIcon(label) {
    const text = String(label).toLowerCase();
    if (text.includes('capital disponible')) return 'savings';
    if (text.includes('capital comprometido') || text.includes('uso de capital')) return 'toll';
    if (text.includes('capital budget') || text.includes('presupuesto')) return 'account_balance';
    if (text.includes('interes + mora') || text.includes('interes y mora') || text.includes('intereses') || text.includes('ganancia')) return 'show_chart';
    if (text.includes('cobrado') || text.includes('recuperacion')) return 'paid';
    if (text.includes('vencido') || text.includes('mora')) return 'warning';
    if (text.includes('activo')) return 'task_alt';
    if (text.includes('saldo')) return 'account_balance_wallet';
    if (text.includes('capital cobrado')) return 'payments';
    return 'monitoring';
}

function KpiCard({ label, value, tone }) {
    const toneClass = tone ? `kpi-tone-${tone}` : '';
    return (
        <article className={`kpi ${toneClass}`}>
            <div className="kpi-top">
                <span className="material-symbols-outlined">{kpiIcon(label)}</span>
                <p>{label}</p>
            </div>
            <h4>{value}</h4>
        </article>
    );
}

function CapitalGauge({ usage, committed, available, budget }) {
    const pct = Math.min(usage, 100);
    return (
        <div className="capital-gauge">
            <div className="capital-gauge-header">
                <h4>Uso de Capital</h4>
                <span className="capital-gauge-pct">{usage.toFixed(1)}%</span>
            </div>
            <div className="capital-gauge-bar">
                <div className="capital-gauge-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="capital-gauge-legend">
                <div className="capital-gauge-item">
                    <span className="capital-dot capital-dot-used" />
                    <span>Comprometido</span>
                    <strong>{money(committed)}</strong>
                </div>
                <div className="capital-gauge-item">
                    <span className="capital-dot capital-dot-free" />
                    <span>Disponible</span>
                    <strong>{money(available)}</strong>
                </div>
            </div>
        </div>
    );
}

function CustomCalendar({ loans, customersById }) {
    const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));
    const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
    const today = useMemo(() => startOfDay(new Date()), []);

    const { year, month, gridDays } = useMemo(() => {
        const computedYear = currentDate.getFullYear();
        const computedMonth = currentDate.getMonth();
        const firstDayOfMonth = new Date(computedYear, computedMonth, 1).getDay();
        const daysInMonth = new Date(computedYear, computedMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(computedYear, computedMonth, 0).getDate();
        const days = [];

        for (let index = firstDayOfMonth - 1; index >= 0; index -= 1) {
            days.push({
                date: new Date(computedYear, computedMonth - 1, daysInPrevMonth - index),
                isCurrentMonth: false
            });
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            days.push({
                date: new Date(computedYear, computedMonth, day),
                isCurrentMonth: true
            });
        }

        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day += 1) {
            days.push({
                date: new Date(computedYear, computedMonth + 1, day),
                isCurrentMonth: false
            });
        }

        return {
            year: computedYear,
            month: computedMonth,
            gridDays: days
        };
    }, [currentDate]);

    // Build all pending installment dates to render every expected due day.
    const dueEventsByDay = useMemo(() => {
        const map = new Map();
        loans
            .filter((loan) => loan.status !== 'paid')
            .forEach((loan) => {
                loanPendingInstallments(loan).forEach((installment) => {
                    const timestamp = installment.dueDate.getTime();
                    if (!map.has(timestamp)) {
                        map.set(timestamp, []);
                    }
                    map.get(timestamp).push({
                        loan,
                        installmentNumber: installment.installmentNumber,
                        dueDate: installment.dueDate
                    });
                });
            });
        return map;
    }, [loans]);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const isToday = (date) => date.getTime() === today.getTime();
    const isSelected = (date) => date.getTime() === selectedDate.getTime();
    
    const loansOnDate = (date) => dueEventsByDay.get(startOfDay(date).getTime()) || [];

    // Gather selected events
    const selectedEvents = useMemo(() => loansOnDate(selectedDate), [selectedDate, dueEventsByDay]);

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
        <div className="dashboard-calendar">
            <div className="calendar-header">
                <h3>{monthNames[month]} {year}</h3>
                <div className="calendar-nav">
                    <button type="button" onClick={prevMonth}><span className="material-symbols-outlined">chevron_left</span></button>
                    <button type="button" onClick={nextMonth}><span className="material-symbols-outlined">chevron_right</span></button>
                </div>
            </div>
            
            <div className="calendar-grid">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                    <div key={d} className="calendar-weekday">{d}</div>
                ))}
                
                {gridDays.map((dayObj, i) => {
                    const date = dayObj.date;
                    const eventsCount = loansOnDate(date).length;
                    
                    let className = "calendar-day";
                    if (!dayObj.isCurrentMonth) className += " other-month";
                    if (isToday(date)) className += " today";
                    if (isSelected(date)) className += " selected";
                    if (eventsCount > 0) className += " has-payment tap-pop";
                    
                    return (
                        <div 
                            key={i} 
                            className={className} 
                            onClick={() => setSelectedDate(date)}
                        >
                            {date.getDate()}
                            {eventsCount > 0 && <span className="calendar-marker" />}
                        </div>
                    );
                })}
            </div>

            <div className="calendar-events-panel">
                <h4>Vencimientos ({formatDate(selectedDate)})</h4>
                
                {selectedEvents.length > 0 ? (
                    selectedEvents.map((event) => {
                        const customer = customersById.get(event.loan.customerId);
                        const estimatedInstallment = Math.min(loanInstallment(event.loan), loanOutstanding(event.loan));
                        const isInterestOnly = isInterestOnlyBalloonLoan(event.loan);
                        return (
                            <div key={`${event.loan.id}-${event.installmentNumber}`} className="calendar-event-item">
                                <div className="calendar-event-info">
                                    <strong>{customer ? nameFromEmail(customer.name) : 'Anónimo'}</strong>
                                    <span>Préstamo {event.loan.id} · {isInterestOnly ? 'Periodo' : 'Cuota'} {event.installmentNumber}/{event.loan.termMonths}</span>
                                </div>
                                <span className="calendar-event-amount" title={isInterestOnly ? 'Interes estimado del periodo' : 'Cuota estimada'}>{money(estimatedInstallment)}</span>
                            </div>
                        );
                    })
                ) : (
                    <div className="muted small" style={{textAlign: 'center', padding: '1rem 0'}}>
                        No hay pagos programados para este día.
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { state } = useApp();
    const { openDrawer } = useDrawer();
    const { customersById } = usePortfolioDerivedData(state);
    const today = useMemo(() => startOfDay(new Date()), []);

    const dashboardSnapshot = useMemo(() => {
        const activeCount = state.loans.filter((loan) => loan.status === 'active').length;
        const overdueCount = state.loans.filter((loan) => loan.status === 'overdue').length;
        const budget = capitalBudget(state);
        const committed = capitalCommittedFromLoans(state.loans);
        const available = capitalAvailable(state);
        const usage = capitalUsagePct(state);
        const totalOutstanding = sum(state.loans, (loan) => loanOutstanding(loan));

        let totalPrincipalCollected = 0;
        let totalInterestCollected = 0;
        let totalLateFeeCollected = 0;

        state.loans.forEach((loan) => {
            const basePaid = Math.max(Math.min(Number(loan.paidAmount || 0), loanTotalPayable(loan)), 0);
            const breakdown = paymentBreakdown(loan, basePaid);
            totalPrincipalCollected += breakdown.principal;
            totalInterestCollected += breakdown.interest;
            totalLateFeeCollected += loanLateFeePaid(loan, state);
        });

        const dueSoonRows = state.loans
            .filter((loan) => {
                if (loan.status === 'paid') return false;
                const dueDate = loanNextDueDate(loan);
                if (!dueDate) return false;
                const diffDays = Math.floor((dueDate - today) / 86400000);
                return diffDays <= 2;
            })
            .sort((left, right) => {
                const firstDue = loanNextDueDate(left);
                const secondDue = loanNextDueDate(right);
                if (!firstDue) return 1;
                if (!secondDue) return -1;
                return firstDue - secondDue;
            })
            .slice(0, 8)
            .map((loan) => ({
                loan,
                customer: customersById.get(loan.customerId) || null,
                nextDueDate: loanNextDueDate(loan),
                outstanding: loanOutstanding(loan)
            }));

        return {
            activeCount,
            overdueCount,
            budget,
            committed,
            available,
            usage,
            totalOutstanding,
            totalPrincipalCollected: round2(totalPrincipalCollected),
            totalInterestCollected: round2(totalInterestCollected),
            totalLateFeeCollected: round2(totalLateFeeCollected),
            dueSoonRows
        };
    }, [state, customersById, today]);

    const totalInterestAndLateFeeCollected = round2(dashboardSnapshot.totalInterestCollected + dashboardSnapshot.totalLateFeeCollected);

    return (
        <section id="view-dashboard" className="view dashboard-view">
            {/* Header Row with Quick Actions */}
            <div className="dashboard-header">
                <div>
                    <h2 className="dashboard-title">Panel de Operaciones</h2>
                    <p className="muted">Resumen general de la cartera y métricas clave.</p>
                </div>
                <div className="dashboard-actions">
                    <button className="btn btn-primary" type="button" onClick={() => openDrawer('loan')}>
                        <span className="material-symbols-outlined">add</span>
                        Nuevo préstamo
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => openDrawer('payment')}>
                        <span className="material-symbols-outlined">payments</span>
                        Registrar pago
                    </button>
                </div>
            </div>

            {/* Main KPIs – Top Row: Key Financials */}
            <div className="dashboard-kpi-row kpi-grid">
                <KpiCard label="Balance disponible" value={money(dashboardSnapshot.available)} tone="good" />
                <KpiCard label="Capital cobrado" value={money(dashboardSnapshot.totalPrincipalCollected)} tone="neutral" />
                <KpiCard label="Interes + mora ganados" value={money(totalInterestAndLateFeeCollected)} tone="good" />
                <KpiCard label="Saldo por cobrar" value={money(dashboardSnapshot.totalOutstanding)} tone="warn" />
            </div>

                {/* Two Column: Operations + Capital */}
            <div className="dashboard-split">
                {/* Left: Operations summary + Custom Calendar */}
                <div className="dashboard-ops-card card">
                    <div className="dashboard-ops-header">
                        <span className="material-symbols-outlined">assessment</span>
                        <h4>Operaciones Activas</h4>
                    </div>
                    <div className="dashboard-ops-grid">
                        <div className="dashboard-ops-stat">
                            <span className="dashboard-ops-value">{dashboardSnapshot.activeCount}</span>
                            <span className="dashboard-ops-label">Prestamos al dia</span>
                        </div>
                        <div className="dashboard-ops-stat dashboard-ops-stat-warn">
                            <span className="dashboard-ops-value">{dashboardSnapshot.overdueCount}</span>
                            <span className="dashboard-ops-label">Prestamos en atraso</span>
                        </div>
                        <div className="dashboard-ops-stat">
                            <span className="dashboard-ops-value">{state.customers.length}</span>
                            <span className="dashboard-ops-label">Clientes registrados</span>
                        </div>
                        <div className="dashboard-ops-stat">
                            <span className="dashboard-ops-value">{state.payments.length}</span>
                            <span className="dashboard-ops-label">Pagos procesados</span>
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--line-strong)'}}>
                        <CustomCalendar loans={state.loans} customersById={customersById} />
                    </div>
                </div>

                {/* Right (previously left): Capital Gauge */}
                <div className="dashboard-capital-card card">
                    <CapitalGauge
                        usage={dashboardSnapshot.usage}
                        committed={dashboardSnapshot.committed}
                        available={dashboardSnapshot.available}
                        budget={dashboardSnapshot.budget}
                    />
                    <div className="dashboard-capital-budget">
                        <span className="muted small">Presupuesto asignado</span>
                        <strong>{money(dashboardSnapshot.budget)}</strong>
                    </div>
                </div>
            </div>

            {/* Current Loans Table */}
            <div className="card section-stack">
                <div className="section-head split">
                    <h3>Préstamos próximos a vencer</h3>
                    <Link to="/loans" className="action-link">Ver todos →</Link>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Cliente</th>
                                <th>Próximo pago</th>
                                <th>Saldo</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboardSnapshot.dueSoonRows.length > 0 ? dashboardSnapshot.dueSoonRows.map(({ loan, customer, nextDueDate, outstanding }) => {
                                return (
                                    <tr key={loan.id}>
                                        <td data-label="ID">{loan.id}</td>
                                        <td data-label="Cliente">{customer ? customer.name : 'Sin cliente'}</td>
                                        <td data-label="Proximo pago">{formatDate(nextDueDate)}</td>
                                        <td data-label="Saldo">{money(outstanding)}</td>
                                        <td data-label="Estado">{statusTag(loan.status, 'loan')}</td>
                                        <td data-label="Accion">
                                            <Link to={`/loans?id=${loan.id}`} className="action-link">Ver</Link>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr className="empty-row">
                                    <td colSpan="6">
                                        <div className="empty-state">
                                            <span className="material-symbols-outlined">credit_score</span>
                                            <h4>No hay préstamos próximos</h4>
                                            <p>Crea un préstamo para iniciar el seguimiento de cartera.</p>
                                            <button className="btn btn-ghost" type="button" onClick={() => openDrawer('loan')}>Nuevo préstamo</button>
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
