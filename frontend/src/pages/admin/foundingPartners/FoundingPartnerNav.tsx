import { NavLink } from "react-router-dom";
import "./foundingPartners.css";

const links = [
  { to: "/admin/founding-partners", label: "Dashboard", end: true },
  { to: "/admin/founding-partners/prospects", label: "Businesses", end: false },
  {
    to: "/admin/founding-partners/relationship-protections",
    label: "Introductions",
    end: false,
  },
  { to: "/admin/founding-partners/partners", label: "Partners", end: false },
  { to: "/admin/founding-partners/learning-center", label: "Learning Center", end: false },
];

export default function FoundingPartnerNav() {
  return (
    <nav className="fp-subnav fp-no-print" aria-label="Founding Partner Program">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => `fp-subnav-link${isActive ? " fp-subnav-link-active" : ""}`}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
