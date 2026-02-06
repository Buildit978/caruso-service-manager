import { useCallback, useEffect, useState } from "react";
import { getMe } from "../api/auth";
import type { MeUser } from "../api/auth";
import { getToken, clearToken } from "../api/http";

export function useMe() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) return Promise.resolve();
    return getMe()
      .then((res) => setMe(res.user))
      .catch(() => {
        clearToken();
        setMe(null);
      });
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    (async () => {
      try {
        const res = await getMe();
        setMe(res.user);
      } catch {
        clearToken();
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { me, loading, refetch };
}
