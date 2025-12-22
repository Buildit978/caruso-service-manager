import { useEffect, useMemo, useState } from "react";

export function useUnsavedChangesGuard() {
  const [isDirty, setIsDirty] = useState(false);

  // Browser refresh/close tab guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return useMemo(
    () => ({
      isDirty,
      markDirty: () => setIsDirty(true),
      markClean: () => setIsDirty(false),
      setDirty: setIsDirty,
    }),
    [isDirty]
  );
}
