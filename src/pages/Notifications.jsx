import React from 'react';
import { useApp } from '../context/AppContext';

const Notifications = () => {
  const { notifications, markAsRead } = useApp();

  const getIcon = (type) => {
    switch (type) {
      case 'PAYMENT_RECEIVED': return 'payments';
      case 'OVERDUE_ALERT': return 'warning';
      case 'NEW_LOAN': return 'add_shopping_cart';
      case 'PLAN_EXPIRING': return 'event_busy';
      default: return 'notifications';
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'border-ruby bg-ruby-soft';
      case 'WARNING': return 'border-amber bg-amber-soft';
      default: return 'border-blue bg-blue-soft';
    }
  };

  return (
    <div className="page-container max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="title-md">Notificaciones</h2>
        <button className="btn-text">Marcar todas como leídas</button>
      </div>

      <div className="notifications-list flex flex-col gap-4">
        {notifications.length > 0 ? (
          notifications.map(n => (
            <div 
              key={n.id} 
              className={`notification-item glass-card p-4 border-l-4 ${getSeverityClass(n.severity)} ${!n.is_read ? 'unread' : ''}`}
              onClick={() => !n.is_read && markAsRead(n.id)}
            >
              <div className="flex gap-4">
                <div className={`notif-icon-circle severity-${n.severity}`}>
                  <span className="material-icons">{getIcon(n.type)}</span>
                </div>
                <div className="notif-content flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-800">{n.title}</h3>
                    <span className="text-xs text-gray-500">
                      {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <p className="notif-message text-sm text-gray-600">{n.message}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state-full glass-card h-64 flex flex-col items-center justify-center">
            <span className="material-icons text-ruby text-5xl mb-4 opacity-50">notifications_none</span>
            <p className="text-gray-500 font-medium">No tienes notificaciones pendientes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;