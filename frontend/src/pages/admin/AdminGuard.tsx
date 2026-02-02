import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getAdminToken } from "../../api/admin";

interface AdminGuardProps {
  children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  if (!getAdminToken()) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
