import {
  Activity,
  Building2,
  FileSpreadsheet,
  GitCompareArrows,
  LayoutDashboard,
  LayoutGrid,
  MessageCircle,
  Milk,
  Radio,
  Receipt,
  Settings,
  ShieldAlert,
  Tags,
  Users,
  Wallet,
  Warehouse,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLeaf {
  to: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  built: boolean;
  portalPath?: string;
}

export interface NavSection {
  id: string;
  title: string;
  icon: LucideIcon;
  to?: string;
  items: NavLeaf[];
}
export type { NavForm, NavModule } from "../config/portalForms";
export { NAV_MODULES } from "../config/portalForms";

export const APP_PAGES: NavSection[] = [
  {
    id: "today",
    title: "Today",
    icon: LayoutDashboard,
    items: [
      {
        to: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        hint: "Overview of today and the last 30 days",
        built: true,
      },
      {
        to: "/live",
        label: "Live collection",
        icon: Radio,
        hint: "Today's samples as the portal receives them",
        built: true,
      },
    ],
  },
  {
    id: "dairy",
    title: "Dairy",
    icon: Milk,
    items: [
      {
        to: "/collections",
        label: "Farmer Collection",
        icon: FileSpreadsheet,
        hint: "Reports by farmer, centre, day and milk",
        built: true,
      },
      {
        to: "/farmers",
        label: "Farmers",
        icon: Users,
        hint: "Registered farmers and what they poured",
        built: true,
      },
      {
        to: "/centers",
        label: "Centres",
        icon: Warehouse,
        hint: "Your VLCs: litres, farmers and last sample",
        built: true,
      },
      {
        to: "/reports/unionwise",
        label: "Unionwise Collection",
        icon: Building2,
        hint: "Farmers, litres, average fat, SNF, rate and amount per union and society",
        built: true,
      },
      {
        to: "/reports/vlc-status",
        label: "VLC Status",
        icon: Activity,
        hint: "Which centres are active or in active for the chosen dates and shift",
        built: true,
      },
      {
        to: "/reports/variance",
        label: "Variance Report",
        icon: GitCompareArrows,
        hint: "DOC collection against VLC collection, with the difference",
        built: true,
      },
    ],
  },
  {
    id: "money",
    title: "Money",
    icon: Wallet,
    items: [
      {
        to: "/rates",
        label: "Rate chart",
        icon: Tags,
        hint: "Rates the portal applied, per milk type",
        built: true,
      },
      {
        to: "/billing",
        label: "Billing",
        icon: Receipt,
        hint: "10-day bills and payslips",
        built: true,
      },
    ],
  },
  {
    id: "insight",
    title: "Insight",
    icon: ShieldAlert,
    items: [
      {
        to: "/quality",
        label: "Quality watch",
        icon: ShieldAlert,
        hint: "Adulteration and low-quality alerts",
        built: true,
      },
      {
        to: "/pipeline",
        label: "Data pipeline",
        icon: Workflow,
        hint: "Machine to portal to dashboard, and API status",
        built: true,
      },
      {
        to: "/settings",
        label: "Settings",
        icon: Settings,
        hint: "Theme and quality alert limits",
        built: true,
      },
      {
        to: "/contact",
        label: "Contact support",
        icon: MessageCircle,
        hint: "Send a support request or view the temporary service notice",
        built: true,
      },
    ],
  },
];

export const APP_PAGE_LEAVES: NavLeaf[] = APP_PAGES.flatMap((s) => s.items);
export const MORE_ICON = LayoutGrid;
