// src/contexts/ContactSupportContext.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";
import { ContactSupportModal } from "../components/Common/ContactSupportModal";

interface ContactSupportContextType {
  openContactSupport: () => void;
  closeContactSupport: () => void;
}

const ContactSupportContext = createContext<ContactSupportContextType | undefined>(undefined);

export const useContactSupport = () => {
  const context = useContext(ContactSupportContext);
  if (!context) {
    throw new Error("useContactSupport must be used within ContactSupportProvider");
  }
  return context;
};

interface ContactSupportProviderProps {
  children: ReactNode;
}

export const ContactSupportProvider: React.FC<ContactSupportProviderProps> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const openContactSupport = () => setIsOpen(true);
  const closeContactSupport = () => setIsOpen(false);

  return (
    <ContactSupportContext.Provider
      value={{ openContactSupport, closeContactSupport }}
    >
      {children}
      <ContactSupportModal isOpen={isOpen} onClose={closeContactSupport} />
    </ContactSupportContext.Provider>
  );
};

