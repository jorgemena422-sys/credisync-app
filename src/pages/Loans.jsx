import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney, getRiskLevel } from '../utils/helpers';
import { useDrawer } from '../context/DrawerContext';

const Loans = () => {
  const { loans, activeLoans, stats } = useApp();
  const { openLoanDrawer, openPaymentDrawer } = useDrawer();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = loan.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || loan.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="page-container">
      {/* Header & Stats */}
      <div className="page-header">
        <div className="header-info">
          <p className="text-muted">Total de Cartera</p>
          <div className="flex-center">
            <h2 className="title-lg">{formatMoney(stats?.total_lent || 0)}</h2>
            <span className="badge-positive ml-3">+{loans.length} activos</span>
          </div>
        </div>
        <button className="btn-primary" onClick={openLoanDrawer}>
          <span className="material-icons">add</span>
          Nuevo Préstamo
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar glass-card">
        <div className="search-box">
          <span className="material-icons">search</span>
          <input 
            type="text" 
            placeholder="Buscar por cliente..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          <button 
            className={`tab ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            Todos
          </button>
          <button 
            className={`tab ${filter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setFilter('ACTIVE')}
          >
            Activos
          </button>
          <button 
            className={`tab ${filter === 'LATE' ? 'active' : ''}`}
            onClick={() => setFilter('LATE')}
          >
            Mora
          </button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="glass-card table-responsive hide-mobile">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Monto</th>
              <th>Pendiente</th>
              <th>Progreso</th>
              <th>Tasa</th>
              <th>Riesgo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredLoans.map(loan => (
              <tr key={loan.id}>
                <td>
                  <div className="user-info">
                    <strong>{loan.customer_name}</strong>
                    <span>Iniciado: {new Date(loan.created_at).toLocaleDateString()}</span>
                  </div>
                </td>
                <td className="font-bold">{formatMoney(loan.amount)}</td>
                <td className="text-ruby">{formatMoney(loan.outstanding_balance)}</td>
                <td>
                  <div className="progress-group">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{width: `${(loan.paid_installments / loan.term) * 100}%`}}
                      ></div>
                    </div>
                    <span>{loan.paid_installments}/{loan.term} cuotas</span>
                  </div>
                </td>
                <td>{loan.interest_rate}%</td>
                <td>
                  <span className={`risk-tag ${getRiskLevel(loan.days_overdue)}`}>
                    {loan.days_overdue} días
                  </span>
                </td>
                <td>
                  <button className="icon-btn-sm" onClick={() => openPaymentDrawer(loan.id)}>
                    <span className="material-icons">payments</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Grid */}
      <div className="mobile-grid show-mobile">
        {filteredLoans.map(loan => (
          <div key={loan.id} className="mobile-card glass-card">
            <div className="card-top">
              <div className="card-user">
                <strong>{loan.customer_name}</strong>
                <span className={`risk-dot ${getRiskLevel(loan.days_overdue)}`}></span>
              </div>
              <div className="card-amount">
                {formatMoney(loan.outstanding_balance)}
              </div>
            </div>
            <div className="card-mid">
              <div className="progress-group">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{width: `${(loan.paid_installments / loan.term) * 100}%`}}
                  ></div>
                </div>
                <span>Progreso: {Math.round((loan.paid_installments / loan.term) * 100)}%</span>
              </div>
            </div>
            <div className="card-actions">
              <button 
                className="btn-card-primary"
                onClick={() => openPaymentDrawer(loan.id)}
              >
                Cobrar Cuota
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Loans;