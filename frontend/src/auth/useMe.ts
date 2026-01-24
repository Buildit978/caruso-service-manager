import { useEffect, useState } from "react";
import { getMe } from "../api/auth";
import { getToken, clearToken } from "../api/http";

type Role = "owner" | "manager" | "technician";
type Me = { id: string; role: Role; accountId: string; name?: string; email?: string };

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

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

  return { me, loading };
}
