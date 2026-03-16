import React from 'react';
import { useApp } from '../context/AppContext';
import { money, sum, loanOutstanding, capitalCommittedFromLoans } from '../utils/helpers';

export default function Reports() {
    const { state } = useApp();
    const advancedReportsEnabled = Boolean(state?.subscription?.features?.advancedReportsEnabled);

    if (!advancedReportsEnabled) {
        return (
            <section id="view-reports" className="view">
                <div className="card section-stack">
                    <div className="empty-state">
                        <span className="material-symbols-outlined">workspace_premium</span>
                        <h4>Reportes avanzados no habilitados</h4>
                        <p>Este módulo es un feature de pago. Solicita al superadministrador activar un plan con reportes avanzados.</p>
                    </div>
                </div>
            </section>
        );
    }

    const totalLent = sum(state.loans, l => l.principal);
    const totalCollected = sum(state.payments, p => p.amount);
    const totalOutstanding = sum(state.loans, loanOutstanding);

    return (
        <section id="view-reports" className="view">
            <div className="card section-stack">
                <div className="section-head">
                    <h3>Reportes financieros</h3>
                </div>

                <div className="report-grid">
                    <div className="kpi-grid">
                        <article className="kpi motion-item">
                            <div className="kpi-top">
                                <span className="material-symbols-outlined">account_balance_wallet</span>
                                <p>Capital prestado historico</p>
                            </div>
                            <h4>{money(totalLent)}</h4>
                        </article>
                        <article className="kpi motion-item">
                            <div className="kpi-top">
                                <span className="material-symbols-outlined">paid</span>
                                <p>Total recuperado</p>
                            </div>
                            <h4>{money(totalCollected)}</h4>
                        </article>
                        <article className="kpi motion-item">
                            <div className="kpi-top">
                                <span className="material-symbols-outlined">trending_up</span>
                                <p>Utilidad bruta estimada</p>
                            </div>
                            <h4>{money(totalCollected + totalOutstanding - totalLent)}</h4>
                        </article>
                    </div>
                </div>
            </div>
        </section>
    );
}
