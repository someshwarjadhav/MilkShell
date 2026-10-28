import {
  Activity,
  BarChart3,
  Building2,
  FileSpreadsheet,
  Gauge,
  GitCompareArrows,
  Inbox,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Library,
  ListChecks,
  MessageCircle,
  Milk,
  Radio,
  Receipt,
  Route,
  Settings,
  ShieldAlert,
  Tags,
  User,
  UserCog,
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
export interface NavForm {
  name: string;
  url: string;
  key: string;

  route?: string;
}

export interface NavModule {
  name: string;
  url: string;
  icon: LucideIcon;

  route?: string;
  children?: NavForm[];
}

const form = (
  name: string,
  url: string,
  key: string,
  route?: string,
): NavForm => ({ name, url, key, route });

export const NAV_MODULES: NavModule[] = [
  { name: "Dashboard", url: "/dashboard", icon: Gauge, route: "/" },
  {
    name: "Collection",
    url: "/base",
    icon: ListChecks,
    children: [
      form(
        "Live collection",
        "/base/live-collection",
        "live-collection",
        "/live",
      ),
    ],
  },
  {
    name: "Administrator",
    url: "/administrator",
    icon: UserCog,
    children: [
      form("Center Access", "/administrator/center-access", "center-access"),
      form("Bill Unfreeze", "/administrator/bill-freeze", "bill-freeze"),
      form(
        "System Administrator",
        "/administrator/system-administrator",
        "system-administrator",
      ),
      form("User Access", "/administrator/useraccess", "useraccess"),
      form(
        "Route Master",
        "/administrator/route-supervisor",
        "route-supervisor",
      ),
      form(
        "Member Sync Async",
        "/administrator/dpu-sync-async",
        "dpu-sync-async",
      ),
      form(
        "Rate Sync Async",
        "/administrator/rate-sync-async",
        "rate-sync-async",
      ),
      form(
        "Config Sync Async",
        "/administrator/config-sync-async",
        "config-sync-async",
      ),
    ],
  },
  {
    name: "Account",
    url: "/account",
    icon: Landmark,
    children: [
      form("Receipt Voucher", "/account/receipt-voucher", "receipt-voucher"),
      form("Payment Voucher", "/account/payment-voucher", "payment-voucher"),
    ],
  },
  {
    name: "Report",
    url: "/base",
    icon: BarChart3,
    children: [
      form(
        "Farmer collection",
        "/base/farmer-collection",
        "farmer-collection",
        "/collections",
      ),
      form(
        "Farmer collection",
        "/base/farmer-collection-report",
        "farmer-collection-report",
        "/collections",
      ),
      form(
        "Farmerwise Collection",
        "/base/farmerwise-collection",
        "farmerwise-collection",
        "/reports/farmerwise",
      ),
      form("BMC Collection", "/base/bmc-collection", "bmc-collection"),
      form(
        "Unionwise Collection",
        "/base/unionwise-collection",
        "unionwise-collection",
        "/reports/unionwise",
      ),
      form(
        "Vlcc Collection",
        "/base/vlcc-collection",
        "vlcc-collection",
        "/reports/vlcc",
      ),
      form(
        "Vlcc Collection Report",
        "/base/vlcc-collection-report",
        "vlcc-collection-report",
        "/reports/vlcc",
      ),
      form(
        "VLC Status",
        "/base/vlc-status",
        "vlc-status",
        "/reports/vlc-status",
      ),
      form("Difference", "/base/difference", "difference"),
      form(
        "Variance Report",
        "/base/variance",
        "variance",
        "/reports/variance",
      ),
      form("Dispatch Report", "/base/dispatch-report", "dispatch-report"),
      form("Milk Sale Report", "/base/milk-sale-report", "milk-sale-report"),
      form("Collection CA", "/base/collection-ca", "collection-ca"),
      form("Collection CDA", "/base/collection-cda", "collection-cda"),
      form(
        "Cleaning Report",
        "/base/cleaning-report",
        "cleaning-report",
        "/reports/cleaning",
      ),
      form(
        "Eko Calibration",
        "/base/eko-calibration",
        "eko-calibration",
        "/reports/eko-calibration",
      ),
      form("Eko Correction", "/base/eko-correction", "eko-correction"),
      form("RMRD", "/base/rmrd", "rmrd"),
      form("Deduction Report", "/base/deduction-report", "deduction-report"),
      form("Store Stock", "/base/store-stock", "store-stock"),
      form("Farmer Ledger", "/base/farmer-ledger", "farmer-ledger"),
      form(
        "Rate Chart Sync Status",
        "/base/rate-chart-sync-status",
        "rate-chart-sync-status",
      ),
    ],
  },
  {
    name: "Master",
    url: "/master",
    icon: Library,
    children: [
      form("MCC Master", "/master/mcc-master", "mcc-master"),
      form("Route Master", "/master/route-master", "route-master"),
      form("VLC Master", "/master/vlc-master", "vlc-master"),
      form(
        "Farmer Master",
        "/master/farmer-master",
        "farmer-master",
        "/farmers",
      ),
      form("User Master", "/master/user-master", "user-master"),
      form("Customer Master", "/master/customer-master", "customer-master"),
      form("Linked Accounts", "/master/code-master", "code-master"),
      form("Route Supervisor", "/master/route-supervisor", "route-supervisor"),
      form("Bill Cycle Master", "/master/billcycle-master", "billcycle-master"),
      form("Head Master", "/master/deduction-master", "deduction-master"),
      form(
        "Subcategory Master",
        "/master/subcategory-master",
        "subcategory-master",
      ),
      form("Item Master", "/master/item-master", "item-master"),
      form("Rate Group Master", "/master/rategroup-master", "rategroup-master"),
      form(
        "Rate Master",
        "/master/excel-rate-upload",
        "excel-rate-upload",
        "/master/excel-rate-upload",
      ),
      form(
        "Rate Status",
        "/master/rate-status",
        "rate-status",
        "/master/rate-status",
      ),
    ],
  },
  {
    name: "Transactions",
    url: "/Transactions",
    icon: Inbox,
    children: [
      form(
        "BMC Milk Entry",
        "/Transactions/vlc-milk-entry",
        "vlc-milk-entry",
        "/transactions/vlc-milk-entry",
      ),
      form(
        "Farmer Milk Entry",
        "/Transactions/farmer-milk-collection",
        "farmer-milk-collection",
        "/transactions/farmer-milk-entry",
      ),
      form(
        "Manage Collection",
        "/Transactions/manage-collection",
        "manage-collection",
        "/transactions/manage-collection",
      ),
      form(
        "Sales Rate Master",
        "/Transactions/sales-rate-master",
        "sales-rate-master",
      ),
      form("Sales Order", "/Transactions/sale-order", "sale-order"),
      form(
        "Attendance",
        "/Transactions/attendance-details",
        "attendance-details",
      ),
      form("Dispatch", "/Transactions/dispatch-details", "dispatch-details"),
      form(
        "New Excel Rate Upload",
        "/Transactions/new-excel-rate-upload",
        "new-excel-rate-upload",
      ),
      form(
        "Cattle Feed Sale",
        "/Transactions/cattlefeed-sale",
        "cattlefeed-sale",
      ),
      form(
        "Sale Entry",
        "/Transactions/cattlefeed-sale-single-code",
        "cattlefeed-sale-single-code",
      ),
      form(
        "Production Output",
        "/Transactions/production-output",
        "production-output",
      ),
      form(
        "Deduction Entry",
        "/Transactions/deduction-entry-single-code",
        "deduction-entry-single-code",
      ),
      form("SMS", "/Transactions/sms", "sms"),
    ],
  },
  {
    name: "RMRD",
    url: "/rmrd",
    icon: Route,
    children: [
      form("Route Master", "/rmrd/route-master", "route-master"),
      form("Morning Weight", "/rmrd/morning-weight", "morning-weight"),
      form("VLC Data Download", "/rmrd/vlc-data-download", "vlc-data-download"),
      form(
        "Morning Milk Collection",
        "/rmrd/milk-collection-morning",
        "milk-collection-morning",
      ),
    ],
  },
  {
    name: "Billing",
    url: "/billing",
    icon: Receipt,
    children: [
      form("Adjust Master", "/billing/adjust-master", "adjust-master"),
      form(
        "Deduction Priority",
        "/billing/deduction-priority",
        "deduction-priority",
      ),
      form(
        "Standard Deduction",
        "/billing/commission-master",
        "commission-master",
        "/billing/standard-deduction",
      ),
      form(
        "VLC Standard Deduction",
        "/billing/commission-master-owner",
        "commission-master-owner",
        "/billing/vlc-standard-deduction",
      ),
      form("Deduction Entry", "/billing/deduction-entry", "deduction-entry"),
      form(
        "Cash Payment Summary",
        "/billing/cash-payment-summary",
        "cash-payment-summary",
        "/billing/cash-payment-summary",
      ),
  
      form(
        "Farmer Bill",
        "/billing/farmer-bill",
        "farmer-bill",
        "/billing/farmer-bill",
      ),
      form(
        "Farmer Bill",
        "/billing/farmer-bill-single-code",
        "farmer-bill-single-code",
        "/billing/farmer-bill",
      ),
      form(
        "CattleFeed Farmer Bill",
        "/billing/farmer-bill-cattlefeed",
        "farmer-bill-cattlefeed",
      ),
      form("Payment Summary", "/billing/payment-summary", "payment-summary"),
      form(
        "Bank Payment Summary",
        "/billing/payment-summary-single-code",
        "payment-summary-single-code",
      ),
      form("VLC Milk Bill", "/billing/vlc-milk-bill", "vlc-milk-bill"),
    ],
  },
  {
    name: "Settings",
    url: "/Settings",
    icon: Settings,
    children: [
      form(
        "Mobile App Settings",
        "/Settings/settings",
        "settings",
        "/settings/mobile-app",
      ),
      form(
        "Eko Milk Settings",
        "/Settings/eko-milk-settings",
        "eko-milk-settings",
        "/settings/eko-milk-settings",
      ),
      form(
        "DPU Settings",
        "/Settings/dpu-settings",
        "dpu-settings",
        "/settings/dpu-settings",
      ),
    ],
  },
  {
    name: "Profile",
    url: "/profile",
    icon: User,
    children: [form("Profile", "/profile/profile", "profile")],
  },
  {
    name: "Support",
    url: "/Support",
    icon: LifeBuoy,
    children: [
      form(
        "My Support Tickets",
        "/Support/mysupport-tickets",
        "mysupport-tickets",
        "/contact",
      ),
      form("Create Tickets", "/Support/create-ticket", "create-ticket"),
      form(
        "Encryption Decryption",
        "/Support/encryption-decryption",
        "encryption-decryption",
      ),
    ],
  },
];

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