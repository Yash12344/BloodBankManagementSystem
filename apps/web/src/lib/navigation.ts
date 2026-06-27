/**
 * Single source of truth for the dashboard modules. Used by the sidebar and the
 * command palette. Each item is gated by `<module>.view` permission.
 */
export interface NavItem {
  label: string;
  module: string;
  href: string;
}

export const NAV: NavItem[] = [
  { label: "Dashboard", module: "dashboard", href: "/dashboard" },
  { label: "Donors", module: "donors", href: "/donors" },
  { label: "Collection", module: "collection", href: "/collection" },
  { label: "Lab", module: "lab", href: "/lab" },
  { label: "Inventory", module: "inventory", href: "/inventory" },
  { label: "Patients", module: "patients", href: "/patients" },
  { label: "Requests", module: "requests", href: "/requests" },
  { label: "Issue", module: "issue", href: "/issue" },
  { label: "Hospitals", module: "hospitals", href: "/hospitals" },
  { label: "Camps", module: "camps", href: "/camps" },
  { label: "Staff", module: "staff", href: "/staff" },
  { label: "Billing", module: "billing", href: "/billing" },
  { label: "Reports", module: "reports", href: "/reports" },
  { label: "Settings", module: "settings", href: "/settings" },
];
