// frontend/src/contexts/AccessContext.tsx
// Tracks server-proven access state for Customers and Vehicles (403 = denied)

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface AccessContextType {
  customersAccess: boolean | null; // null = unknown, true = allowed, false = denied
  vehiclesAccess: boolean | null; // null = unknown, true = allowed, false = denied
  setCustomersAccess: (allowed: boolean) => void;
  setVehiclesAccess: (allowed: boolean) => void;
}

const AccessContext = createContext<AccessContextType | undefined>(undefined);

export function AccessProvider({ children }: { children: ReactNode }) {
  // In-memory state only (not persisted)
  // Backend is the authority; this is just UX state
  const [customersAccess, setCustomersAccess] = useState<boolean | null>(null);
  const [vehiclesAccess, setVehiclesAccess] = useState<boolean | null>(null);

  return (
    <AccessContext.Provider value={{ customersAccess, vehiclesAccess, setCustomersAccess, setVehiclesAccess }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  const context = useContext(AccessContext);
  if (context === undefined) {
    throw new Error("useAccess must be used within AccessProvider");
  }
  return context;
}
