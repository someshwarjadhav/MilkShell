import {
  BarChart3,
  Gauge,
  Inbox,
  Landmark,
  LifeBuoy,
  Library,
  ListChecks,
  Receipt,
  Route,
  Settings,
  User,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
      form(
        "User Access",
        "/administrator/useraccess",
        "useraccess",
        "/administrator/user-access",
      ),
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
      form(
        "VLC Master",
        "/master/vlc-master",
        "vlc-master",
        "/master/vlc-master",
      ),
      form(
        "Farmer Master",
        "/master/farmer-master",
        "farmer-master",
        "/master/farmer-master",
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
        "/billing/cattlefeed-farmer-bill",
      ),
      form("Payment Summary", "/billing/payment-summary", "payment-summary"),
      form(
        "Bank Payment Summary",
        "/billing/payment-summary-single-code",
        "payment-summary-single-code",
        "/billing/bank-payment-summary",
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