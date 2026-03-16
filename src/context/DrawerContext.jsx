import React, { createContext, useContext, useState } from 'react';
import NewCustomerDrawer from '../components/NewCustomerDrawer';
import NewLoanDrawer from '../components/NewLoanDrawer';
import NewPaymentDrawer from '../components/NewPaymentDrawer';

const DrawerContext = createContext(null);

export const DrawerProvider = ({ children }) => {
    const [activeDrawer, setActiveDrawer] = useState(null);

    const openDrawer = (drawerName) => setActiveDrawer(drawerName);
    const closeDrawer = () => setActiveDrawer(null);

    return (
        <DrawerContext.Provider value={{ activeDrawer, openDrawer, closeDrawer }}>
            {children}
            <NewCustomerDrawer isOpen={activeDrawer === 'customer'} onClose={closeDrawer} />
            <NewLoanDrawer isOpen={activeDrawer === 'loan'} onClose={closeDrawer} />
            <NewPaymentDrawer isOpen={activeDrawer === 'payment'} onClose={closeDrawer} />
        </DrawerContext.Provider>
    );
};

export const useDrawer = () => useContext(DrawerContext);
