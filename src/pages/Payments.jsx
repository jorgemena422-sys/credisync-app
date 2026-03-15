import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney, getRiskLevel } from '../utils/helpers';
import { useDrawer } from '../context/DrawerContext';

const Payments = () => {
  const { collectionQueue, recentPayments } = useApp();
  const { openPaymentDrawer } = useDrawer();
  const [activeTab, setActiveTab] = useState('QUEUE'); // QUEUE, HISTORY, PROMISES

  return (
    <div className="page-container">
      <div className="tabs-header glass-card">
        <button 
          className={`tab-btn ${activeTab === 'QUEUE' ? 'active' : ''}`}
          onClick={() => setActiveTab('QUEUE')}
        >
          <span className="material-icons">list_alt</span>
          Cola de Cobros
          <span className="tab-count">{collectionQueue.length}</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'HISTORY' ? 'active' : ''}`}
          onClick={() => setActiveTab('HISTORY')}
        >
          <span className="material-icons">history</span>
          Historial Reaciente
        </button>
      </div>

      <div className="tab-content mt-6">
        {activeTab === 'QUEUE' && (
          <div className="collection-queue">
            {collectionQueue.length > 0 ? (
              collectionQueue.map(item => (
                <div key={item.id} className="queue-card glass-card">
                  <div className="queue-left">
                    <div className="client-marker">
                      <span className={`marker-dot ${getRiskLevel(item.days_overdue)}`}></span>
                    </div>
                    <div className="client-details">
                      <h3>{item.customer_name}</h3>
                      <p>{item.loan_type_label} • {item.address}</p>
                    </div>
                  </div>
                  
                  <div className="queue-center">
                    <div className="payment-info">
                      <span className="label">Cuota Pendiente</span>
                      <strong className="amount">{formatMoney(item.installment_value)}</strong>
                    </div>
                    <div className="balance-info">
                      <span>Restan: {formatMoney(item.outstanding_balance)}</span>
                    </div>
                  </div>

                  <div className="queue-actions">
                    <button className="btn-whatsapp">
                      <i className="fab fa-whatsapp"></i>
                    </button>
                    <button 
                      className="btn-pay"
                      onClick={() => openPaymentDrawer(item.loan_id)}
                    >
                      Cobrar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span className="material-icons">check_circle</span>
                <p>¡Todo al día! No hay cobros pendientes para hoy.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div className="glass-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Metodo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td><strong>{p.customer_name}</strong></td>
                    <td className="text-emerald font-bold">{formatMoney(p.amount)}</td>
                    <td>
                      <span className="method-tag">{p.method}</span>
                    </td>
                    <td>
                      <button className="icon-btn-sm"><span className="material-icons">receipt_long</span></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payments;