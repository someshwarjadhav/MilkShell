import { asFlag } from "../report/report.api.ts";
import { dpuGet } from "../http/dpu";
import {
  isObj,
  norm,
  pick,
  pickLike,
  pickValue,
  rowsFrom,
  type Obj,
} from "../utils/loose";

// Menu binding: DPU API only -> https://dpu.shivinfotech.co.in/api/Login/menu?userid=<id>
// (reply is decrypted inside dpuGet).
export const getMenu = (userid: string): Promise<unknown> =>
  dpuGet(`/Login/menu?userid=${encodeURIComponent(userid)}`, 0);

export interface MenuNode {
  id: string;
  title: string;
  url: string;
  children: MenuNode[];

  enabled: boolean;
}

const TITLE_KEYS = [
  "formname",
  "modulename",
  "menuname",
  "menutitle",
  "title",
  "name",
  "label",
  "displayname",
  "text",
  "pagename",
  "formname",
  "menu",
];
const URL_KEYS = [
  "formclassname",
  "url",
  "link",
  "path",
  "route",
  "routerlink",
  "menuurl",
  "pageurl",
  "navigateurl",
  "href",
  "formurl",
  "action",
];
const ID_KEYS = ["menuid", "id", "pageid", "formid"];
const PARENT_KEYS = [
  "parentid",
  "parentmenuid",
  "parent",
  "pid",
  "parentmenu",
  "mainmenuid",
];
const CHILD_KEYS = [
  "children",
  "submenu",
  "submenus",
  "childmenu",
  "childmenus",
  "items",
  "menus",
  "subitems",
  "child",
  "subs",
];

function enabledOf(row: Obj): boolean {
  for (const k of [
    "isactive",
    "status",
    "isenabled",
    "enabled",
    "isvisible",
    "visible",
  ]) {
    const key = Object.keys(row).find((x) => norm(x) === k);
    if (key !== undefined && asFlag(row[key]) === false) return false;
  }
  return true;
}

function nodeOf(row: Obj, index: number): { node: MenuNode; parent: string } {
  let inner = pickValue(row, CHILD_KEYS);

  if (!Array.isArray(inner))
    inner = Object.values(row).find(
      (v) => Array.isArray(v) && v.length > 0 && v.every(isObj),
    );
  return {
    node: {
      id:
        pick(row, ID_KEYS) ||
        pickLike(row, ["id"], ["parent", "pid", "user", "role", "icon"]) ||
        `m${index}`,
      title:
        pick(row, TITLE_KEYS) ||
        pickLike(
          row,
          ["name", "title", "caption", "label", "text", "menu", "desc"],
          [
            "id",
            "icon",
            "parent",
            "url",
            "link",
            "path",
            "route",
            "image",
            "img",
            "class",
          ],
        ),
      url:
        pick(row, URL_KEYS) ||
        pickLike(
          row,
          ["url", "link", "path", "route", "href", "page", "form"],
          ["id", "name", "title", "icon", "image", "parent"],
        ),
      enabled: enabledOf(row),
      children: Array.isArray(inner)
        ? inner.filter(isObj).map((r, i) => nodeOf(r, i).node)
        : [],
    },
    parent:
      pick(row, PARENT_KEYS) || pickLike(row, ["parent"], ["name", "title"]),
  };
}

const MODULE_KEYS = [
  "modulename",
  "mainmenuname",
  "mainmenu",
  "menugroup",
  "groupname",
  "parentname",
  "parentmenuname",
  "module",
];

const looksJson = (t: string) => /^[[{]/.test(t.trim());

/** Finds the list of menu rows wherever the reply keeps it (root, data, nested object, JSON-in-a-string). */
function menuRows(json: unknown, depth = 0): Obj[] {
  if (depth > 5) return [];
  if (typeof json === "string") {
    if (!looksJson(json)) return [];
    try {
      return menuRows(JSON.parse(json), depth + 1);
    } catch {
      return [];
    }
  }
  const direct = rowsFrom(json);
  if (direct.length) return direct;
  if (!isObj(json)) return [];
  for (const v of Object.values(json)) {
    if (Array.isArray(v) && v.length > 0 && v.every(isObj)) return v as Obj[];
  }
  for (const v of Object.values(json)) {
    if (isObj(v) || (typeof v === "string" && looksJson(v))) {
      const got = menuRows(v, depth + 1);
      if (got.length) return got;
    }
  }
  return [];
}

export function parseMenu(json: unknown): MenuNode[] {
  const rows = menuRows(json);
  const entries = rows.map((r, i) => ({
    ...nodeOf(r, i),
    module: pick(r, MODULE_KEYS),
  }));
  const byId = new Map(entries.map((e) => [e.node.id, e.node]));
  const roots: MenuNode[] = [];
  const moduleRoots = new Map<string, MenuNode>();
  for (const { node, parent, module } of entries) {
    const host =
      parent && parent !== "0" && parent !== node.id
        ? byId.get(parent)
        : undefined;
    if (host) {
      host.children.push(node);
      continue;
    }
    // flat rows: every row is a form and carries its module name -> group the forms under their module
    if (module && !node.children.length && norm(module) !== norm(node.title)) {
      let root = moduleRoots.get(norm(module));
      if (!root) {
        root = { id: `mod:${norm(module)}`, title: module, url: "", enabled: true, children: [] };
        moduleRoots.set(norm(module), root);
        roots.push(root);
      }
      root.children.push(node);
      continue;
    }
    roots.push(node);
  }
  if (!roots.length && json !== null && json !== undefined)
    console.warn("[menu] no menu rows could be read from the reply:", json);
  return roots;
}

const ROUTES: Array<{ to: string; aliases: string[] }> = [
  { to: "/", aliases: ["dashboard", "home", "index"] },
  { to: "/live", aliases: ["livecollection", "live", "livedata"] },
  {
    to: "/collections",
    aliases: ["collections", "farmercollection", "villagecollection"],
  },
  {
    to: "/reports/farmerwise",
    aliases: ["farmerwisecollection", "farmerwise"],
  },
  {
    to: "/reports/vlcc",
    aliases: ["vlcccollection", "vlccollection", "vlcccollectionreport"],
  },
  { to: "/reports/cleaning", aliases: ["cleaningreport", "cleaning"] },
  { to: "/reports/eko-calibration", aliases: ["ekocalibration"] },
  { to: "/reports/eko-correction", aliases: ["ekocorrection"] },
  {
    to: "/transactions/vlc-milk-entry",
    aliases: ["vlcmilkentry", "bmcmilkentry", "vlcmilkcollection"],
  },
  {
    to: "/transactions/farmer-milk-entry",
    aliases: ["farmermilkentry", "farmermilkcollection"],
  },
  { to: "/transactions/manage-collection", aliases: ["managecollection"] },
  {
    to: "/transactions/sale-entry",
    aliases: ["saleentry", "cattlefeedsale", "cattlefeedsalesinglecode"],
  },
  {
    to: "/transactions/deduction-entry",
    aliases: ["deductionentrysinglecode"],
  },
  { to: "/master/vlc-master", aliases: ["vlcmaster"] },
  { to: "/master/farmer-master", aliases: ["farmermaster"] },
  { to: "/master/excel-rate-upload", aliases: ["excelrateupload", "ratemaster"] },
  { to: "/master/rate-status", aliases: ["ratestatus"] },
  { to: "/settings/mobile-app", aliases: ["mobileappsettings"] },
  { to: "/settings/eko-milk-settings", aliases: ["ekomilksettings"] },
  { to: "/settings/dpu-settings", aliases: ["dpusettings"] },
  {
    to: "/farmers",
    aliases: [
      "farmers",
      "farmer",
      "farmerledger",
      "farmerlist",
    ],
  },
  {
    to: "/centers",
    aliases: ["centers", "centres", "center", "centre", "vlcc"],
  },
  { to: "/rates", aliases: ["ratechart", "rates", "rate"] },
  { to: "/billing", aliases: ["billing", "tendaybill", "payslip"] },
  {
    to: "/billing/farmer-bill",
    aliases: ["farmerbill", "farmerbillsinglecode"],
  },

  {
    to: "/billing/cash-payment-summary",
    aliases: ["cashpaymentsummary", "cashpaymentsummarysinglecode"],
  },
  { to: "/billing/standard-deduction", aliases: ["commissionmaster", "standarddeduction"] },
  { to: "/billing/vlc-standard-deduction", aliases: ["commissionmasterowner", "vlcstandarddeduction"] },
  {
    to: "/billing/bank-payment-summary",
    aliases: ["paymentsummarysinglecode", "bankpaymentsummary"],
  },
  {
    to: "/billing/cattlefeed-farmer-bill",
    aliases: ["farmerbillcattlefeed", "cattlefeedfarmerbill"],
  },
  {
    to: "/billing/vlc-milk-bill",
    aliases: ["vlcmilkbill", "vlccmilkbill"],
  },
  { to: "/quality", aliases: ["quality", "qualitywatch"] },
  { to: "/pipeline", aliases: ["pipeline", "datapipeline"] },
  {
    to: "/reports/unionwise",
    aliases: [
      "unionwisecollection",
      "unionwise",
      "unionwisereport",
      "mccwisecollection",
      "mccwisecolection",
      "mccwise",
    ],
  },
  {
    to: "/reports/vlc-status",
    aliases: ["vlcstatus", "vlccstatus", "vlcstatusreport"],
  },
  { to: "/reports/variance", aliases: ["variancereport", "variance"] },
  { to: "/reports/cda", aliases: ["cdareport", "collectioncda"] },
  { to: "/administrator/bill-freeze", aliases: ["billfreeze", "billunfreeze", "unfreeze"] },
  { to: "/account/payment-voucher", aliases: ["paymentvoucher"] },
  { to: "/account/receipt-voucher", aliases: ["receiptvoucher"] },
  { to: "/settings", aliases: ["settings"] },
  {
    to: "/contact",
    aliases: ["contact", "contactsupport", "mysupportticket", "supportticket"],
  },
];

const CONTAINED = [
  "farmercollection",
  "villagecollection",
  "livecollection",
  "farmerledger",
  "ratechart",
  "farmerwisecollection",
  "vlcccollection",
  "unionwisecollection",
  "mccwisecollection",
  "variancereport",
  "vlcstatus",
];

export const urlKey = (url: string) =>
  norm(
    url
      .replace(/^[a-z]+:\/\/[^/]+/i, "")
      .split(/[?#]/)[0]
      .split("/")
      .filter(Boolean)
      .pop() ?? "",
  );

export function routeFor(node: MenuNode): string | null {
  const candidates = [urlKey(node.url), norm(node.title)].filter(Boolean);
  for (const c of candidates) {
    const hit = ROUTES.find((r) => r.aliases.includes(c));
    if (hit) return hit.to;
  }
  for (const c of candidates) {
    const alias = CONTAINED.find((a) => c.includes(a));
    if (alias) return ROUTES.find((r) => r.aliases.includes(alias))!.to;
  }
  return null;
}