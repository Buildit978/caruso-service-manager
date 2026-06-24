import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getPartnerToken } from "../../api/partner";

interface PartnerGuardProps {
  children: ReactNode;
}

export default function PartnerGuard({ children }: PartnerGuardProps) {
  const location = useLocation();
  if (!getPartnerToken()) {
    return <Navigate to="/partner/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
