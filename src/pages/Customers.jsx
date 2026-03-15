import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney } from '../utils/helpers';
import { useDrawer } from '../context/DrawerContext';

const Customers = () => {
  const { customers, customerStats } = useApp();
  const { openCustomerDrawer } = useDrawer();
  const [search, setSearch] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-info">
          <p className="text-muted">Total Clientes</p>
          <h2 className="title-lg">{customers.length} Registrados</h2>
        </div>
        <button className="btn-primary" onClick={openCustomerDrawer}>
          <span className="material-icons">person_add</span>
          Crear Cliente
        </button>
      </div>

      <div className="glass-card mb-6">
        <div className="search-box full-width">
          <span className="material-icons">search</span>
          <input 
            type="text" 
            placeholder="Buscar por nombre, DNI o teléfono..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="customer-grid">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map(customer => (
            <div key={customer.id} className="customer-card glass-card animate-scale-in">
              <div className="customer-header">
                <div className="avatar">
                  {customer.name.charAt(0)}
                </div>
                <div className="customer-main-info">
                  <h3>{customer.name}</h3>
                  <span className="customer-phone">{customer.phone}</span>
                </div>
                <button className="icon-btn">
                  <span className="material-icons">more_vert</span>
                </button>
              </div>

              <div className="customer-stats">
                <div className="stat-item">
                  <span>Préstamos Activos</span>
                  <strong>{customer.active_loans_count || 0}</strong>
                </div>
                <div className="stat-item">
                  <span>Deuda Total</span>
                  <strong className="text-ruby">{formatMoney(customer.total_debt || 0)}</strong>
                </div>
              </div>

              <div className="customer-footer">
                <div className="integrity-meter">
                  <div className="meter-label">
                    <span>Nivel de Confianza</span>
                    <span>{customer.score || 100}%</span>
                  </div>
                  <div className="meter-bar">
                    <div 
                      className="meter-fill" 
                      style={{
                        width: `${customer.score || 100}%`,
                        backgroundColor: (customer.score || 100) > 80 ? '#10b981' : '#f59e0b'
                      }}
                    ></div>
                  </div>
                </div>
                <button className="btn-outline-sm mt-3">Ver Historial</button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state-full glass-card">
            <span className="material-icons">person_off</span>
            <p>No se encontraron clientes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Customers;