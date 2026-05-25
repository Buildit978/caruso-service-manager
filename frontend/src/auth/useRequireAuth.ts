import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../api/http";

/**
 * Redirects unauthenticated visitors away from protected create/edit flows.
 * Returns false until a token is present.
 */
export function useRequireAuth(): boolean {
  const navigate = useNavigate();
  const authed = Boolean(getToken());

  useEffect(() => {
    if (!authed) {
      navigate("/login", { replace: true });
    }
  }, [authed, navigate]);

  return authed;
}
