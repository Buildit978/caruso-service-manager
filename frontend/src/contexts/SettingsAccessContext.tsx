// frontend/src/contexts/SettingsAccessContext.tsx
// Tracks server-proven Settings access state (403 = denied)

import { createContext, useContext, useState, ReactNode } from "react";

interface SettingsAccessContextType {
  hasAccess: boolean | null; // null = unknown, true = allowed, false = denied
  setHasAccess: (allowed: boolean) => void;
}

const SettingsAccessContext = createContext<SettingsAccessContextType | undefined>(undefined);

export function SettingsAccessProvider({ children }: { children: ReactNode }) {
  // In-memory state only (not persisted)
  // Backend is the authority; this is just UX state
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  return (
    <SettingsAccessContext.Provider value={{ hasAccess, setHasAccess }}>
      {children}
    </SettingsAccessContext.Provider>
  );
}

export function useSettingsAccess() {
  const context = useContext(SettingsAccessContext);
  if (context === undefined) {
    throw new Error("useSettingsAccess must be used within SettingsAccessProvider");
  }
  return context;
}
