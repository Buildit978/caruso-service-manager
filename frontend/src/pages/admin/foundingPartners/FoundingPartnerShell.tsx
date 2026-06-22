import type { ReactNode } from "react";
import FoundingPartnerNav from "./FoundingPartnerNav";
import "./foundingPartners.css";

export type FoundingPartnerShellVariant = "paper" | "list";

interface FoundingPartnerShellProps {
  children: ReactNode;
  /** paper = detail/narrative only; list = dashboard + admin list pages */
  variant?: FoundingPartnerShellVariant;
}

export default function FoundingPartnerShell({
  children,
  variant = "paper",
}: FoundingPartnerShellProps) {
  return (
    <div className={`fp-shell fp-shell--${variant}`}>
      <FoundingPartnerNav />
      <div className="fp-content">{children}</div>
    </div>
  );
}
