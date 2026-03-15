export const moneyFmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });

export function money(value) {
    return moneyFmt.format(value || 0);
}

export function shortMoney(value) {
    if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${round2(value)}`;
}

export function formatDate(value) {
    if (!value) return "-";
    const date = value instanceof Date ? value : toDate(value);
    return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function round2(number) {
    return Math.round((Number(number) + Number.EPSILON) * 100) / 100;
}

export function parseNumericInput(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    const raw = String(value == null ? "" : value).trim();
    if (!raw) {
        return fallback;
    }

    const normalized = raw.replace(/\s/g, "");
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    const decimalIndex = Math.max(lastComma, lastDot);

    if (decimalIndex >= 0) {
        let integerPart = normalized.slice(0, decimalIndex).replace(/[.,]/g, "");
        let decimalPart = normalized.slice(decimalIndex + 1).replace(/[.,]/g, "");
        const parsed = Number(`${integerPart}.${decimalPart}`);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    const parsed = Number(normalized.replace(/[.,]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function sum(list, getter) {
    return list.reduce((acc, item) => acc + getter(item), 0);
}

export function nameFromEmail(email) {
    const localPart = String(email).split("@")[0] || "admin";
    return localPart
        .replace(/[._-]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function initials(value) {
    return String(value || "UA")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
}

export function isoToday() {
    return new Date().toISOString().slice(0, 10);
}

export function toDate(value) {
    const raw = String(value || "");
    if (raw.includes("T")) {
        return new Date(raw);
    }
    return new Date(`${raw}T00:00:00`);
}

export function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function loanTotalPayable(loan) {
    if (loan.interestRateMode === 'monthly') {
        return round2(loan.principal * (1 + (loan.interestRate / 100) * loan.termMonths));
    }
    return round2(loan.principal * (1 + (loan.interestRate / 100) * (loan.termMonths / 12)));
}

export function loanInstallment(loan) {
    return round2(loanTotalPayable(loan) / loan.termMonths);
}

export function loanOutstanding(loan) {
    return Math.max(round2(loanTotalPayable(loan) - (loan.paidAmount || 0)), 0);
}

// How much of the total expected payback is purely interest
export function loanInterestPortion(loan) {
    return Math.max(0, round2(loanTotalPayable(loan) - Number(loan.principal || 0)));
}

// Calculates what % of ANY payment goes to principal vs interest, based on the loan totals.
// Returns { principal: X, interest: Y }
export function paymentBreakdown(loan, paymentAmount) {
    const totalPayable = loanTotalPayable(loan);
    const amount = Number(paymentAmount) || 0;
    
    if (totalPayable <= 0) return { principal: amount, interest: 0 };
    
    // The ratio of interest in the entire loan life
    const totalInt = loanInterestPortion(loan);
    const interestRatio = totalInt / totalPayable;
    
    const interestPaid = round2(amount * interestRatio);
    const principalPaid = round2(amount - interestPaid);
    
    return { principal: principalPaid, interest: interestPaid };
}

export function loanNextDueDate(loan) {
    if (!loan || loanOutstanding(loan) <= 0.5) return null;
    const paidInstallments = Math.min(loan.termMonths, Math.floor((loan.paidAmount || 0) / loanInstallment(loan)));
    const date = toDate(loan.startDate);
    date.setMonth(date.getMonth() + paidInstallments + 1);
    return date;
}

export function loanPendingInstallments(loan) {
    if (!loan || loanOutstanding(loan) <= 0.5) return [];

    const termMonths = Number(loan.termMonths) || 0;
    if (termMonths <= 0) return [];

    const installmentValue = loanInstallment(loan);
    if (!Number.isFinite(installmentValue) || installmentValue <= 0) return [];

    const paidInstallments = Math.min(termMonths, Math.max(0, Math.floor((loan.paidAmount || 0) / installmentValue)));
    const schedule = [];

    for (let installmentNumber = paidInstallments + 1; installmentNumber <= termMonths; installmentNumber += 1) {
        const dueDate = toDate(loan.startDate);
        if (Number.isNaN(dueDate.getTime())) continue;
        dueDate.setMonth(dueDate.getMonth() + installmentNumber);
        schedule.push({
            installmentNumber,
            dueDate: startOfDay(dueDate)
        });
    }

    return schedule;
}

export function loanMaturityDate(loan) {
    const date = toDate(loan.startDate);
    date.setMonth(date.getMonth() + loan.termMonths);
    return date;
}

export function loanCapitalCommitted(loan) {
    return Math.max(round2(Number(loan.principal || 0) - Number(loan.paidAmount || 0)), 0);
}

export function capitalCommittedFromLoans(loans) {
    return round2((loans || []).reduce((acc, loan) => acc + loanCapitalCommitted(loan), 0));
}

export function capitalBudget(state) {
    return Math.max(Number(state?.settings?.capitalBudget) || 0, 0);
}

export function capitalAvailable(state) {
    return round2(Math.max(capitalBudget(state) - capitalCommittedFromLoans(state.loans), 0));
}

export function capitalUsagePct(state) {
    const budget = capitalBudget(state);
    if (budget <= 0) return 0;
    return round2((capitalCommittedFromLoans(state.loans) / budget) * 100);
}

export function daysOverdue(loan, state) {
    const dueDate = loanNextDueDate(loan);
    if (!dueDate) return 0;
    const today = startOfDay(new Date());
    const diff = Math.floor((today - dueDate) / 86400000);
    const grace = Number(state?.settings?.graceDays) || 0;
    return Math.max(0, diff - grace);
}

function monthGap(from, to) {
    return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

function riskTone(score) {
    if (score >= 80) return { level: 'Bajo', tone: 'normal' };
    if (score >= 65) return { level: 'Medio', tone: 'medium' };
    if (score >= 45) return { level: 'Alto', tone: 'high' };
    return { level: 'Critico', tone: 'critical' };
}

export function defaultRiskModel() {
    return {
        initialScore: 70,
        onTimePaymentReward: 2.2,
        keptPromiseReward: 3.8,
        paymentActivityReward: 0.45,
        paymentActivityCap: 12,
        latePaymentPenalty: 3.4,
        brokenPromisePenalty: 11.5,
        pendingPromisePenalty: 2.4,
        overdueDayPenalty: 0.75,
        overdueDayCap: 20,
        overdueAccumulatedPenalty: 0.14,
        overdueAccumulatedCap: 14,
        lagInstallmentPenalty: 3.8,
        noPaymentHistoryPenalty: 6
    };
}

function loanDisciplineSnapshot(loan, loanPayments, state, today) {
    const termMonths = Number(loan.termMonths) || 0;
    const installment = loanInstallment(loan);

    if (termMonths <= 0 || !Number.isFinite(installment) || installment <= 0) {
        return {
            onTimeInstallments: 0,
            lateInstallments: 0,
            lagInstallments: 0,
            overdueDays: 0
        };
    }

    const graceDays = Number(state?.settings?.graceDays) || 0;
    const sortedPayments = [...loanPayments].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    let cumulativePaid = 0;
    let coveredInstallments = 0;
    let onTimeInstallments = 0;
    let lateInstallments = 0;

    sortedPayments.forEach((payment) => {
        cumulativePaid += Number(payment.amount || 0);
        const coveredNow = Math.min(termMonths, Math.floor((cumulativePaid + Number.EPSILON) / installment));
        if (coveredNow <= coveredInstallments) return;

        const paidDate = startOfDay(toDate(payment.date));
        for (let installmentNumber = coveredInstallments + 1; installmentNumber <= coveredNow; installmentNumber += 1) {
            const dueDate = toDate(loan.startDate);
            dueDate.setMonth(dueDate.getMonth() + installmentNumber);
            const dueWithGrace = startOfDay(dueDate);
            dueWithGrace.setDate(dueWithGrace.getDate() + graceDays);

            if (paidDate.getTime() <= dueWithGrace.getTime()) {
                onTimeInstallments += 1;
            } else {
                lateInstallments += 1;
            }
        }

        coveredInstallments = coveredNow;
    });

    const startDate = startOfDay(toDate(loan.startDate));
    const elapsedInstallments = Math.min(termMonths, Math.max(0, monthGap(startDate, today) + 1));
    const lagInstallments = Math.max(elapsedInstallments - coveredInstallments, 0);

    return {
        onTimeInstallments,
        lateInstallments,
        lagInstallments,
        overdueDays: daysOverdue(loan, state)
    };
}

export function customerRiskProfile(customerId, state) {
    const riskModel = {
        ...defaultRiskModel(),
        ...((state && state.riskModel) || {})
    };

    const base = {
        score: 60,
        level: 'Sin historial',
        tone: 'normal',
        overdueDaysMax: 0,
        overdueDaysTotal: 0,
        outstanding: 0,
        lagInstallments: 0,
        onTimeInstallments: 0,
        lateInstallments: 0,
        brokenPromises: 0,
        pendingPromises: 0,
        keptPromises: 0,
        pointsEarned: 0,
        pointsLost: 0,
        activeLoans: 0,
        totalLoans: 0
    };

    if (!customerId || !state) return base;

    const loans = (state.loans || []).filter((loan) => loan.customerId === customerId);
    const totalLoans = loans.length;
    if (totalLoans === 0) {
        return base;
    }

    const activeLoans = loans.filter((loan) => loan.status !== 'paid');
    const outstanding = sum(activeLoans, (loan) => loanOutstanding(loan));
    const customerPayments = (state.payments || []).filter((payment) => payment.customerId === customerId);
    const today = startOfDay(new Date());

    const overdueDaysList = [];
    let lagInstallments = 0;
    let onTimeInstallments = 0;
    let lateInstallments = 0;

    activeLoans.forEach((loan) => {
        const loanPayments = customerPayments.filter((payment) => payment.loanId === loan.id);
        const snapshot = loanDisciplineSnapshot(loan, loanPayments, state, today);
        overdueDaysList.push(snapshot.overdueDays);
        lagInstallments += snapshot.lagInstallments;
        onTimeInstallments += snapshot.onTimeInstallments;
        lateInstallments += snapshot.lateInstallments;
    });

    const overdueDaysMax = overdueDaysList.length ? Math.max(...overdueDaysList) : 0;
    const overdueDaysTotal = overdueDaysList.reduce((acc, value) => acc + value, 0);

    const promises = (state.paymentPromises || []).filter((promise) => promise.customerId === customerId);
    const brokenPromises = promises.filter((promise) => promise.status === 'broken').length;
    const pendingPromises = promises.filter((promise) => promise.status === 'pending').length;
    const keptPromises = promises.filter((promise) => promise.status === 'kept').length;

    const paymentsCount = customerPayments.length;

    const pointsEarned = round2(
        (onTimeInstallments * riskModel.onTimePaymentReward) +
        (keptPromises * riskModel.keptPromiseReward) +
        Math.min(paymentsCount, Math.max(0, Number(riskModel.paymentActivityCap) || 0)) * riskModel.paymentActivityReward
    );

    const pointsLost = round2(
        (lateInstallments * riskModel.latePaymentPenalty) +
        (brokenPromises * riskModel.brokenPromisePenalty) +
        (pendingPromises * riskModel.pendingPromisePenalty) +
        Math.min(overdueDaysMax * riskModel.overdueDayPenalty, riskModel.overdueDayCap) +
        Math.min(overdueDaysTotal * riskModel.overdueAccumulatedPenalty, riskModel.overdueAccumulatedCap) +
        (lagInstallments * riskModel.lagInstallmentPenalty) +
        ((paymentsCount === 0 && totalLoans > 0) ? riskModel.noPaymentHistoryPenalty : 0)
    );

    const initialScore = Number(riskModel.initialScore) || 0;
    const score = Math.max(0, Math.min(100, Math.round(initialScore + pointsEarned - pointsLost)));
    const { level, tone } = riskTone(score);

    return {
        score,
        level,
        tone,
        overdueDaysMax,
        overdueDaysTotal,
        outstanding: round2(outstanding),
        lagInstallments,
        onTimeInstallments,
        lateInstallments,
        brokenPromises,
        pendingPromises,
        keptPromises,
        pointsEarned,
        pointsLost,
        activeLoans: activeLoans.length,
        totalLoans
    };
}

export function esc(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}