export const REPORT_FARMER = "/collections";
export const REPORT_FARMERWISE = "/reports/farmerwise";
export const REPORT_VLCC = "/reports/vlcc";
export const REPORT_VLC_STATUS = "/reports/vlc-status";
export const REPORT_VARIANCE = "/reports/variance";
export const REPORT_CLEANING = "/reports/cleaning";
export const REPORT_EKO = "/reports/eko-calibration";
export const REPORT_UNIONWISE = "/reports/unionwise";

export const PAGE_VLC_MILK_ENTRY = "/transactions/vlc-milk-entry";
export const PAGE_FARMER_MILK_ENTRY = "/transactions/farmer-milk-entry";

export const PAGE_FARMER_MASTER = "/master/farmer-master";
export const PAGE_MOBILE_SETTINGS = "/settings/mobile-app";
export const PAGE_DPU_SETTINGS = "/settings/dpu-settings";
export const PAGE_EKO_MILK_SETTINGS = "/settings/eko-milk-settings";
export const PAGE_MANAGE_COLLECTION = "/transactions/manage-collection";
export const PAGE_RATE_MASTER = "/master/excel-rate-upload";
export const PAGE_RATE_STATUS = "/master/rate-status";
export const PAGE_BANK_PAYMENT_SUMMARY = "/billing/bank-payment-summary";
export const PAGE_CATTLEFEED_FARMER_BILL = "/billing/cattlefeed-farmer-bill";

export const EXCLUSIVE_PAGES: string[] = [
  PAGE_FARMER_MASTER,
  PAGE_VLC_MILK_ENTRY,
  PAGE_MOBILE_SETTINGS,
  PAGE_DPU_SETTINGS,
  PAGE_EKO_MILK_SETTINGS,
  PAGE_MANAGE_COLLECTION,
  PAGE_RATE_MASTER,
  PAGE_RATE_STATUS,
  PAGE_BANK_PAYMENT_SUMMARY,
  PAGE_CATTLEFEED_FARMER_BILL,
];
export const ENTRY_USERS: string[] = ["abc@gmail.com"];

export const PAGES_BY_USER: Record<string, string[]> = {
  "abc@gmail.com": [
    PAGE_FARMER_MASTER,
    PAGE_VLC_MILK_ENTRY,
    PAGE_MANAGE_COLLECTION,
    PAGE_MOBILE_SETTINGS,
    PAGE_DPU_SETTINGS,
    PAGE_EKO_MILK_SETTINGS,
    PAGE_RATE_MASTER,
    PAGE_RATE_STATUS,
    PAGE_BANK_PAYMENT_SUMMARY,
    PAGE_CATTLEFEED_FARMER_BILL,
  ],

  "prachidairykaladera@gmail.com": [
    PAGE_FARMER_MASTER,
    PAGE_DPU_SETTINGS,
    PAGE_RATE_MASTER,
    PAGE_RATE_STATUS,
    PAGE_BANK_PAYMENT_SUMMARY,
  ],
};

export const EXCLUSIVE_REPORTS: string[] = [REPORT_CLEANING, REPORT_EKO];


export const COLLECTION_REPORTS: string[] = [
  REPORT_FARMER,
  REPORT_FARMERWISE,
  REPORT_VLCC,
];

export const ALL_REPORTS: string[] = [
  REPORT_FARMER,
  REPORT_UNIONWISE,
  REPORT_VLC_STATUS,
  REPORT_VARIANCE,
  REPORT_FARMERWISE,
  REPORT_VLCC,
  ...EXCLUSIVE_REPORTS,
];

export const REPORT_LABELS: Record<string, { label: string; hint: string }> = {
  [REPORT_FARMER]: {
    label: "Farmer Collection",
    hint: "Every farmer sample at a centre",
  },
  [REPORT_FARMERWISE]: {
    label: "Farmerwise Collection",
    hint: "Farmer by farmer totals of the milk poured",
  },
  [REPORT_VLCC]: {
    label: "Vlcc Collection",
    hint: "Milk collected per VLC centre",
  },
  [REPORT_VLC_STATUS]: {
    label: "VLC Status",
    hint: "Which centres are active or in active",
  },
  [REPORT_VARIANCE]: {
    label: "Variance Report",
    hint: "DOC collection against VLC collection, with the difference",
  },
  [REPORT_CLEANING]: {
    label: "Cleaning Report",
    hint: "Cleaning done at each centre",
  },
  [REPORT_EKO]: {
    label: "Eko Calibration",
    hint: "Eko analyser calibration records",
  },
  [REPORT_UNIONWISE]: {
    label: "Unionwise Collection",
    hint: "Litres, fat, SNF and amount per union and society",
  },
};

export const REPORTS_BY_USER: Record<string, string[]> = {
  "abc@gmail.com": [
    REPORT_FARMER,
    REPORT_FARMERWISE,
    REPORT_VLCC,
    REPORT_VLC_STATUS,
    REPORT_VARIANCE,
    REPORT_CLEANING,
    REPORT_EKO,
  ],

  "prachidairykaladera@gmail.com": [
    REPORT_FARMER,
    REPORT_FARMERWISE,
    REPORT_VLCC,
    REPORT_UNIONWISE,
    REPORT_VLC_STATUS,
    REPORT_VARIANCE,
  ],
};

export const reportsFor = (email?: string | null): string[] | null =>
  (email ? REPORTS_BY_USER[email.trim().toLowerCase()] : undefined) ?? null;

export function canOpenReport(
  email: string | null | undefined,
  route: string,
): boolean {
  if (EXCLUSIVE_PAGES.includes(route))
    return (
      !!email &&
      (PAGES_BY_USER[email.trim().toLowerCase()] ?? []).includes(route)
    );
  const own = reportsFor(email);
  if (own) return !ALL_REPORTS.includes(route) || own.includes(route);
  return !EXCLUSIVE_REPORTS.includes(route);
}

export const BILLING_BY_USER: Record<string, string[]> = {
  "abc@gmail.com": [
    "Standard Deduction",
    "VLC Standard Deduction",
    "Farmer Bill",
    "CattleFeed Farmer Bill",
    "Bank Payment Summary",
    "Cash Payment Summary",
    "VLC Milk Bill",
  ],
  "prachidairykaladera@gmail.com": [
    "Farmer Bill",
    "Bank Payment Summary",
    "Cash Payment Summary",
    "VLC Milk Bill",
  ],
};

export const billingFor = (email?: string | null): string[] | null =>
  (email ? BILLING_BY_USER[email.trim().toLowerCase()] : undefined) ?? null;

export const BILL_EXTENDED_USERS: string[] = ["abc@gmail.com"];
export const isExtendedBill = (email?: string | null): boolean =>
  !!email && BILL_EXTENDED_USERS.includes(email.trim().toLowerCase());

export const HIDE_MORE_USERS: string[] = [
  "abc@gmail.com",
  "prachidairykaladera@gmail.com",
];
export const hideMoreFor = (email?: string | null): boolean =>
  !!email && HIDE_MORE_USERS.includes(email.trim().toLowerCase());
