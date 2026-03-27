import { useMemo } from 'react';

export function usePortfolioDerivedData(state) {
    const customers = state?.customers || [];
    const loans = state?.loans || [];
    const payments = state?.payments || [];
    const paymentPromises = state?.paymentPromises || [];

    const customersById = useMemo(() => {
        const map = new Map();
        customers.forEach((customer) => {
            map.set(customer.id, customer);
        });
        return map;
    }, [customers]);

    const loansByCustomerId = useMemo(() => {
        const map = new Map();
        loans.forEach((loan) => {
            const current = map.get(loan.customerId);
            if (current) {
                current.push(loan);
            } else {
                map.set(loan.customerId, [loan]);
            }
        });
        return map;
    }, [loans]);

    const paymentsByCustomerId = useMemo(() => {
        const map = new Map();
        payments.forEach((payment) => {
            const current = map.get(payment.customerId);
            if (current) {
                current.push(payment);
            } else {
                map.set(payment.customerId, [payment]);
            }
        });
        return map;
    }, [payments]);

    const paymentsByLoanId = useMemo(() => {
        const map = new Map();
        payments.forEach((payment) => {
            const current = map.get(payment.loanId);
            if (current) {
                current.push(payment);
            } else {
                map.set(payment.loanId, [payment]);
            }
        });
        return map;
    }, [payments]);

    const paymentPromisesByCustomerId = useMemo(() => {
        const map = new Map();
        paymentPromises.forEach((promise) => {
            const current = map.get(promise.customerId);
            if (current) {
                current.push(promise);
            } else {
                map.set(promise.customerId, [promise]);
            }
        });
        return map;
    }, [paymentPromises]);

    const paymentPromisesByLoanId = useMemo(() => {
        const map = new Map();
        paymentPromises.forEach((promise) => {
            const current = map.get(promise.loanId);
            if (current) {
                current.push(promise);
            } else {
                map.set(promise.loanId, [promise]);
            }
        });
        return map;
    }, [paymentPromises]);

    return {
        customersById,
        loansByCustomerId,
        paymentsByCustomerId,
        paymentsByLoanId,
        paymentPromisesByCustomerId,
        paymentPromisesByLoanId
    };
}
