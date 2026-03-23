import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { money, loanNextDueDate, loanPendingInstallments, loanOutstanding, loanInstallment, capitalBudget, capitalCommittedFromLoans, capitalAvailable, capitalUsagePct, sum, formatDate, paymentBreakdown, nameFromEmail, startOfDay, loanLateFeePaid, round2, loanTotalPayable } from '../utils/helpers';
import { Link } from 'react-router-dom';
import { useDrawer } from '../context/DrawerContext';

export function statusTag(status, scope = 'default') {
    const normalizedStatus = String(status || '').toLowerCase();
    const defaultMap = {
        active: 'Activo',
        inactive: 'Inactivo',
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

function CustomCalendar({ loans, customers }) {
    const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));
    const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));

    // Get basic calendar info
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Previous month days for padding
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Generate the grid array
    const gridDays = [];
    
    // 1. Padding from previous month
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        gridDays.push({
            date: new Date(year, month - 1, daysInPrevMonth - i),
            isCurrentMonth: false
        });
    }
    
    // 2. Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        gridDays.push({
            date: new Date(year, month, i),
            isCurrentMonth: true
        });
    }
    
    // 3. Padding for next month to complete 6 weeks (42 days) if needed
    const remainingDays = 42 - gridDays.length;
    for (let i = 1; i <= remainingDays; i++) {
        gridDays.push({
            date: new Date(year, month + 1, i),
            isCurrentMonth: false
        });
    }

    // Build all pending installment dates to render every expected due day.
    const dueEventsByDay = new Map();
    loans
        .filter(loan => loan.status !== 'paid')
        .forEach((loan) => {
            loanPendingInstallments(loan).forEach((installment) => {
                const timestamp = installment.dueDate.getTime();
                if (!dueEventsByDay.has(timestamp)) {
                    dueEventsByDay.set(timestamp, []);
                }
                dueEventsByDay.get(timestamp).push({
                    loan,
                    installmentNumber: installment.installmentNumber,
                    dueDate: installment.dueDate
                });
            });
        });

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const isToday = (date) => date.getTime() === startOfDay(new Date()).getTime();
    const isSelected = (date) => date.getTime() === selectedDate.getTime();
    
    const loansOnDate = (date) => dueEventsByDay.get(startOfDay(date).getTime()) || [];

    // Gather selected events
    const selectedEvents = loansOnDate(selectedDate);

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
                        const customer = customers.find(c => c.id === event.loan.customerId);
                        const estimatedInstallment = Math.min(loanInstallment(event.loan), loanOutstanding(event.loan));
                        return (
                            <div key={`${event.loan.id}-${event.installmentNumber}`} className="calendar-event-item">
                                <div className="calendar-event-info">
                                    <strong>{customer ? nameFromEmail(customer.name) : 'Anónimo'}</strong>
                                    <span>Préstamo {event.loan.id} · Cuota {event.installmentNumber}/{event.loan.termMonths}</span>
                                </div>
                                <span className="calendar-event-amount" title="Cuota estimada">{money(estimatedInstallment)}</span>
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

    const activeCount = state.loans.filter(loan => loan.status === 'active').length;
    const overdueCount = state.loans.filter(loan => loan.status === 'overdue').length;
    const budget = capitalBudget(state);
    const committed = capitalCommittedFromLoans(state.loans);
    const available = capitalAvailable(state);
    const usage = capitalUsagePct(state);

    // Calculate broken down financials
    const totalOutstanding = sum(state.loans, loan => loanOutstanding(loan));
    
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

    totalPrincipalCollected = round2(totalPrincipalCollected);
    totalInterestCollected = round2(totalInterestCollected);
    totalLateFeeCollected = round2(totalLateFeeCollected);
    const totalInterestAndLateFeeCollected = round2(totalInterestCollected + totalLateFeeCollected);

    const rows = state.loans
        .filter(loan => {
            if (loan.status === 'paid') return false;
            const dueDate = loanNextDueDate(loan);
            if (!dueDate) return false;

            const today = startOfDay(new Date());
            const diffDays = Math.floor((dueDate - today) / 86400000);
            
            // Show if it's overdue or due within 2 days
            return diffDays <= 2;
        })
        .sort((a, b) => {
            const d1 = loanNextDueDate(a);
            const d2 = loanNextDueDate(b);
            if (!d1) return 1;
            if (!d2) return -1;
            return d1 - d2;
        })
        .slice(0, 8);

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
                <KpiCard label="Balance disponible" value={money(available)} tone="good" />
                <KpiCard label="Capital cobrado" value={money(totalPrincipalCollected)} tone="neutral" />
                <KpiCard label="Interes + mora ganados" value={money(totalInterestAndLateFeeCollected)} tone="good" />
                <KpiCard label="Saldo por cobrar" value={money(totalOutstanding)} tone="warn" />
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
                            <span className="dashboard-ops-value">{activeCount}</span>
                            <span className="dashboard-ops-label">Prestamos al dia</span>
                        </div>
                        <div className="dashboard-ops-stat dashboard-ops-stat-warn">
                            <span className="dashboard-ops-value">{overdueCount}</span>
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
                        <CustomCalendar loans={state.loans} customers={state.customers} />
                    </div>
                </div>

                {/* Right (previously left): Capital Gauge */}
                <div className="dashboard-capital-card card">
                    <CapitalGauge
                        usage={usage}
                        committed={committed}
                        available={available}
                        budget={budget}
                    />
                    <div className="dashboard-capital-budget">
                        <span className="muted small">Presupuesto asignado</span>
                        <strong>{money(budget)}</strong>
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
                            {rows.length > 0 ? rows.map((loan, idx) => {
                                const customer = state.customers.find(c => c.id === loan.customerId);
                                return (
                                    <tr key={loan.id}>
                                        <td data-label="ID">{loan.id}</td>
                                        <td data-label="Cliente">{customer ? customer.name : 'Sin cliente'}</td>
                                        <td data-label="Proximo pago">{formatDate(loanNextDueDate(loan))}</td>
                                        <td data-label="Saldo">{money(loanOutstanding(loan))}</td>
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
