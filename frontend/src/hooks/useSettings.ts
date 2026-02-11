// frontend/src/hooks/useSettings.ts
// Shared hook for fetching settings (shop name, etc.)
import { useEffect, useState } from "react";
import { fetchSettings, type BetaStatus } from "../api/settings";
import type { HttpError } from "../api/http";

export function useSettings() {
  const [shopName, setShopName] = useState<string | null>(null);
  const [betaStatus, setBetaStatus] = useState<BetaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const data = await fetchSettings();
        if (!isMounted) return;
        setShopName(data.shopName || null);
        setBetaStatus(data.betaStatus ?? null);
      } catch (err) {
        // Technicians get 403, others may get network errors
        // Silently fall back to default (no crash)
        if (isMounted) {
          const httpError = err as HttpError;
          // Only log non-403 errors (403 is expected for technicians)
          if (httpError.status !== 403) {
            console.error("Failed to load settings", err);
          }
          setShopName(null);
          setBetaStatus(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  return { shopName, betaStatus, loading };
}
