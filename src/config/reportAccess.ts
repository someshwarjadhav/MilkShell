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
export const PAGE_MANAGE_COLLECTION = "/transactions/manage-collection";

export const PAGE_FARMER_MASTER = "/master/farmer-master";
export const PAGE_VLC_MASTER = "/master/vlc-master";
export const PAGE_RATE_MASTER = "/master/excel-rate-upload";
export const PAGE_RATE_STATUS = "/master/rate-status";

export const PAGE_MOBILE_SETTINGS = "/settings/mobile-app";
export const PAGE_DPU_SETTINGS = "/settings/dpu-settings";
export const PAGE_EKO_MILK_SETTINGS = "/settings/eko-milk-settings";

export const PAGE_BANK_PAYMENT_SUMMARY = "/billing/bank-payment-summary";
export const PAGE_CATTLEFEED_FARMER_BILL = "/billing/cattlefeed-farmer-bill";

export const ALWAYS_OPEN_ROUTES: string[] = ["/", "/settings", "/profile", "/contact"];

export const EXTENDED_BILL_MARKER = PAGE_CATTLEFEED_FARMER_BILL;

/**
 * Position of each report inside the userReportConfig reply (report[0], report[1] ...).
 * Same idea as the portal: getSessionReportAccess("reportaccess")[0] is Farmer Collection.
 * The keys are the names the pages pass to useReportColumns(). Add the next reports here (2, 3 ...).
 */
export const REPORT_INDEX: Record<string, number> = {
  farmercollection: 0,
  vlcccollection: 1,
  // 2+ = order of the report lines in the userReportConfig reply. CONFIRM these numbers with the portal team
  // (check the console log "[getReportAccess] report[index]") and change them here if the order differs.
  farmerwisecollection: 2,
  unionwisecollection: 3,
};

/** Column names the userReportConfig reply may use for each table column key (compared ignoring case / symbols). */
export const COLUMN_ALIASES: Record<string, string[]> = {
  station: ['stationid', 'station'],
  date: ['date', 'trdate', 'collectiondate'],
  shift: ['shift'],
  kind: ['milktype', 'milk'],
  farmerId: ['farmerid', 'farmercode'],
  name: ['name', 'farmername'],
  centre: ['centre', 'centrevlc', 'vlc', 'vlcname', 'stationname'],
  village: ['village', 'villagename', 'vlcname', 'vlcc'],
  litres: ['liter', 'litre', 'litres', 'qty'],
  kg: ['kg', 'weight'],
  fat: ['fat'],
  snf: ['snf'],
  clr: ['clr'],
  rate: ['rate', 'rtpl'],
  amount: ['amount', 'amt'],
  totalLiter: ['totalliter', 'liter', 'totalqty', 'qty'],
  avgFat: ['avgfat', 'averagefat', 'fat'],
  avgSnf: ['avgsnf', 'averagesnf', 'snf'],
  avgRate: ['avgrate', 'averagerate', 'rate'],
  totalAmount: ['totalamount', 'amount'],
  union: ['union', 'unionname'],
  society: ['society', 'societyname'],
  farmer: ['farmer', 'farmers', 'nooffarmer', 'totalfarmer'],
  qty: ['qty', 'quantity', 'liter'],
};

