import React from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney, getRiskLevel } from '../utils/helpers';
import { useDrawer } from '../context/DrawerContext';

const Dashboard = () => {
  const { stats, upcomingLoans, capitalStats } = useApp();
  const { openLoanDrawer, openPaymentDrawer } = useDrawer();

  const cards = [
    { title: 'Capital Activo', value: formatMoney(capitalStats?.active_capital || 0), icon: 'account_balance', color: 'blue' },
    { title: 'Intereses Generados', value: formatMoney(capitalStats?.total_interest || 0), icon: 'trending_up', color: 'emerald' },
    { title: 'Cobros Pendientes', value: formatMoney(stats?.pending_today || 0), icon: 'assignment_late', color: 'amber' },
    { title: 'Eficiencia Cobro', value: `${stats?.collection_efficiency || 0}%`, icon: 'speed', color: 'purple' }
  ];

  return (
    <div className="dashboard-container">
      {/* KPI Cards */}
      <div className="kpi-grid">
        {cards.map((card, i) => (
          <div key={i} className={`kpi-card glass-card border-${card.color}`}>
            <div className="kpi-icon">
              <span className={`material-icons text-${card.color}`}>{card.icon}</span>
            </div>
            <div className="kpi-content">
              <h3>{card.title}</h3>
              <p className="kpi-value">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-main">
        {/* Left Column: Calendar & Agenda */}
        <div className="dashboard-col-left">
          <div className="glass-card calendar-section">
            <div className="card-header">
              <h2>Calendario de Cobros</h2>
              <div className="calendar-controls">
                <button className="icon-btn"><span className="material-icons">chevron_left</span></button>
                <span>Marzo 2024</span>
                <button className="icon-btn"><span className="material-icons">chevron_right</span></button>
              </div>
            </div>
            <div className="mini-calendar">
              {/* Simplified Calendar Grid */}
              <div className="calendar-grid">
                {['D','L','M','X','J','V','S'].map(d => <div key={d} className="cal-day-name">{d}</div>)}
                {Array.from({length: 31}).map((_, i) => (
                  <div key={i} className={`cal-day ${i+1 === 15 ? 'has-events' : ''} ${i+1 === 14 ? 'today' : ''}`}>
                    {i+1}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card quick-stats mt-4">
            <h2>Distribución de Riesgo</h2>
            <div className="risk-bars">
              <div className="risk-bar-item">
                <div className="risk-info"><span>Bajo</span><span>75%</span></div>
                <div className="risk-progress"><div className="progress-fill bg-emerald" style={{width: '75%'}}></div></div>
              </div>
              <div className="risk-bar-item">
                <div className="risk-info"><span>Medio</span><span>15%</span></div>
                <div className="risk-progress"><div className="progress-fill bg-amber" style={{width: '15%'}}></div></div>
              </div>
              <div className="risk-bar-item">
                <div className="risk-info"><span>Crítico</span><span>10%</span></div>
                <div className="risk-progress"><div className="progress-fill bg-ruby" style={{width: '10%'}}></div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming & Actions */}
        <div className="dashboard-col-right">
          <div className="glass-card action-card">
            <h2>Acciones Rápidas</h2>
            <div className="action-buttons">
              <button className="btn-action bg-blue" onClick={openLoanDrawer}>
                <span className="material-icons">add_chart</span>
                Nuevo Préstamo
              </button>
              <button className="btn-action bg-emerald" onClick={openPaymentDrawer}>
                <span className="material-icons">payments</span>
                Registrar Pago
              </button>
            </div>
          </div>

          <div className="glass-card upcoming-section mt-4">
            <div className="card-header">
              <h2>Próximos Vencimientos</h2>
              <button className="btn-text">Ver todos</button>
            </div>
            <div className="upcoming-list">
              {upcomingLoans?.length > 0 ? (
                upcomingLoans.map(loan => (
                  <div key={loan.id} className="upcoming-item">
                    <div className="item-info">
                      <strong>{loan.customer_name}</strong>
                      <span>Cuota {loan.current_installment}/{loan.term}</span>
                    </div>
                    <div className="item-amount text-right">
                      <strong>{formatMoney(loan.installment_value)}</strong>
                      <span className={`risk-tag ${getRiskLevel(loan.days_overdue)}`}>
                        {loan.days_overdue > 0 ? `${loan.days_overdue}d mora` : 'Al día'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <span className="material-icons">event_busy</span>
                  <p>No hay vencimientos para hoy</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;